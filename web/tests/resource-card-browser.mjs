import assert from "node:assert/strict";

const endpoint = process.env.CDP_ENDPOINT ?? "http://127.0.0.1:9222";
const pageUrl =
  process.env.TESSLI_RESOURCE_CARD_URL ??
  "http://127.0.0.1:3000/lab/resource-cards";
const browseUrl = new URL("/resources", pageUrl).href;
const pending = new Map();
let messageId = 0;

async function delay(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function pageTargets() {
  const response = await fetch(`${endpoint}/json/list`);
  const targets = await response.json();
  return targets.filter((target) => target.type === "page");
}

async function findPageTarget() {
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    try {
      const page = (await pageTargets())[0];
      if (page?.webSocketDebuggerUrl) {
        return page;
      }
    } catch {
      // Chrome may still be starting.
    }

    await delay(100);
  }

  throw new Error("Chrome DevTools endpoint did not become ready.");
}

const page = await findPageTarget();
const socket = new WebSocket(page.webSocketDebuggerUrl);

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  const request = pending.get(message.id);

  if (!request) {
    return;
  }

  pending.delete(message.id);
  if (message.error) {
    request.reject(new Error(message.error.message));
  } else {
    request.resolve(message.result);
  }
});

function send(method, params = {}) {
  const id = ++messageId;

  return new Promise((resolve, reject) => {
    pending.set(id, { reject, resolve });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const response = await send("Runtime.evaluate", {
    awaitPromise: true,
    expression,
    returnByValue: true,
  });

  if (response.exceptionDetails) {
    throw new Error(
      response.exceptionDetails.exception?.description ??
        response.exceptionDetails.text ??
        "Browser evaluation failed.",
    );
  }

  return response.result.value;
}

async function waitFor(expression, label, timeout = 7_500) {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    if (await evaluate(expression)) {
      return;
    }

    await delay(50);
  }

  throw new Error(`Timed out waiting for ${label}.`);
}

async function waitForNewTarget(existingIds, label) {
  const deadline = Date.now() + 5_000;

  while (Date.now() < deadline) {
    const target = (await pageTargets()).find(
      (candidate) => !existingIds.has(candidate.id),
    );
    if (target) {
      return target;
    }
    await delay(50);
  }

  throw new Error(`Timed out waiting for ${label}.`);
}

async function closeTarget(targetId) {
  await fetch(`${endpoint}/json/close/${targetId}`);
}

async function revealCard(slug) {
  await evaluate(`(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    document.querySelector('[data-resource-slug="${slug}"]')?.scrollIntoView({
      block: 'center',
    });
  })()`);
  await delay(100);
}

async function hoverCard(slug) {
  const point = await evaluate(`(() => {
    const card = document.querySelector('[data-resource-slug="${slug}"]');
    const rect = card.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  })()`);

  await send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: point.x,
    y: point.y,
  });
}

async function activateCardLink({ button, modifiers = 0 }) {
  const point = await evaluate(`(() => {
    const link = document.querySelector('[data-resource-slug="land-book"] a');
    document.documentElement.style.scrollBehavior = 'auto';
    link.scrollIntoView({ block: 'center' });
    const rect = link.getBoundingClientRect();
    return {
      x: rect.left + Math.min(48, rect.width / 3),
      y: rect.top + Math.min(rect.height - 48, rect.height * 0.75),
    };
  })()`);
  const existingIds = new Set((await pageTargets()).map((target) => target.id));

  await send("Input.dispatchMouseEvent", {
    button,
    clickCount: 1,
    modifiers,
    type: "mousePressed",
    x: point.x,
    y: point.y,
  });
  await send("Input.dispatchMouseEvent", {
    button,
    clickCount: 1,
    modifiers,
    type: "mouseReleased",
    x: point.x,
    y: point.y,
  });

  const target = await waitForNewTarget(existingIds, `${button} link target`);
  await closeTarget(target.id);
}

await send("Page.enable");
await send("Runtime.enable");
await send("Page.navigate", { url: pageUrl });
await waitFor(
  'document.readyState === "complete" && document.querySelectorAll("[data-resource-card]").length === 12',
  "twelve resource-card fixtures",
);

assert.equal(
  await evaluate(
    `document.querySelectorAll('[data-resource-card] > a[target="_blank"][rel="noopener noreferrer"]').length`,
  ),
  12,
  "The profile-less lab fixtures should retain their protected native external links.",
);

await revealCard("land-book");
await waitFor(
  '(() => { const card = document.querySelector("[data-resource-slug=land-book]"); const image = card?.querySelector("img"); return card?.getAttribute("data-media-state") === "preview" && image?.complete === true && image.naturalWidth > 0; })()',
  "the valid preview image",
);
await hoverCard("land-book");
await waitFor(
  'getComputedStyle(document.querySelector("[data-resource-slug=land-book]")).transform !== "none"',
  "the card hover lift",
);
await waitFor(
  'getComputedStyle(document.querySelector("[data-resource-slug=land-book]"), "::before").backgroundSize.includes("100% 1px")',
  "the card hover border trace",
);

await revealCard("lapa-ninja");
await waitFor(
  'document.querySelector("[data-resource-slug=lapa-ninja]")?.getAttribute("data-media-state") === "favicon"',
  "broken preview to fall back to favicon",
);
await revealCard("godly");
await waitFor(
  'document.querySelector("[data-resource-slug=godly]")?.getAttribute("data-media-state") === "generated"',
  "broken preview to fall back to generated mark",
);

const originalUrl = await evaluate("window.location.href");
await evaluate(
  'document.querySelector("[data-resource-slug=designindex] [data-resource-save]")?.click()',
);
await waitFor(
  'document.querySelector("[data-resource-slug=designindex] [data-resource-save]")?.getAttribute("aria-pressed") === "true"',
  "independent save state",
);
assert.equal(
  await evaluate("window.location.href"),
  originalUrl,
  "Save must not trigger the external card link.",
);
await waitFor(
  'document.querySelector("[aria-live=polite]")?.textContent.includes("DesignIndex saved") === true',
  "the save announcement",
);

assert.equal(
  await evaluate(`(() => {
    const card = document.querySelector('[data-resource-slug="toools-design"]');
    const paragraph = Array.from(card.querySelectorAll('p')).find(
      (candidate) => candidate.textContent.trim().length > 80,
    );
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    selection.removeAllRanges();
    selection.addRange(range);
    return selection.toString().length > 80;
  })()`),
  true,
  "Card text should remain selectable.",
);

await activateCardLink({ button: "middle" });
await activateCardLink({ button: "left", modifiers: 2 });
assert.equal(
  await evaluate("window.location.href"),
  originalUrl,
  "Modifier and middle click should leave the source page in place.",
);

assert.equal(
  await evaluate("document.documentElement.scrollWidth <= window.innerWidth"),
  true,
  "The pilot route must not overflow horizontally.",
);

await send("Page.navigate", { url: browseUrl });
await waitFor(
  'document.readyState === "complete" && document.querySelectorAll("[data-browse-view=cards] [data-resource-card]").length > 0',
  "profile-linked Browse cards",
);

assert.equal(
  await evaluate(`(() => {
    const cards = Array.from(
      document.querySelectorAll('[data-browse-view=cards] [data-resource-card]'),
    );

    return cards.every((card) => {
      const inspect = card.querySelector('a[data-resource-inspect]');
      const primary = card.querySelector(':scope > a[data-resource-profile-link]');
      const save = card.querySelector('button[data-resource-save]');
      const visit = card.querySelector('a[data-resource-visit]');
      const unavailable = card.getAttribute('data-resource-status') === 'unavailable';
      const independentActions = unavailable
        ? !visit && /Provider unavailable/.test(card.textContent)
        : visit?.getAttribute('target') === '_blank' &&
          visit?.getAttribute('rel') === 'noopener noreferrer';

      return Boolean(
        inspect &&
          primary?.getAttribute('href')?.startsWith('/resources/') &&
          !primary.hasAttribute('target') &&
          save &&
          independentActions &&
          !card.querySelector('a a, a button, button a, button button'),
      );
    });
  })()`),
  true,
  "Every profile-linked Browse card should keep Inspect, Visit, and Save as independent controls.",
);

assert.equal(
  await evaluate(`(() => {
    const inspect = document.querySelector('[data-browse-view=cards] a[data-resource-inspect]');
    inspect?.focus();
    return document.activeElement === inspect && inspect.closest('[data-resource-card]')?.matches(':focus-within');
  })()`),
  true,
  "The explicit Inspect action should be keyboard-focusable.",
);

socket.close();
console.log(
  "Resource card hover, fallback, save, and independent-action checks passed.",
);
