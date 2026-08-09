import assert from "node:assert/strict";

const endpoint = process.env.CDP_ENDPOINT ?? "http://127.0.0.1:9222";
const origin = process.env.TESSLI_ORIGIN ?? "http://127.0.0.1:3000";
const pending = new Map();
let messageId = 0;

async function delay(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function findPageTarget() {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${endpoint}/json/list`);
      const targets = await response.json();
      const page = targets.find((target) => target.type === "page");
      if (page?.webSocketDebuggerUrl) return page;
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
  if (!request) return;
  pending.delete(message.id);
  if (message.error) request.reject(new Error(message.error.message));
  else request.resolve(message.result);
});

function send(method, params = {}) {
  const id = ++messageId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function pressKey({ code, key, virtualKeyCode }) {
  const params = {
    code,
    key,
    nativeVirtualKeyCode: virtualKeyCode,
    windowsVirtualKeyCode: virtualKeyCode,
  };
  await send("Input.dispatchKeyEvent", { ...params, type: "keyDown" });
  await send("Input.dispatchKeyEvent", { ...params, type: "keyUp" });
}

async function evaluate(expression) {
  const response = await send("Runtime.evaluate", {
    awaitPromise: true,
    expression,
    returnByValue: true,
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.text);
  }
  return response.result.value;
}

async function waitFor(expression, label, timeout = 10_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return;
    await delay(75);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

async function navigate(pathname) {
  await send("Page.navigate", { url: `${origin}${pathname}` });
  await waitFor(
    `document.readyState === "complete" && Boolean(document.querySelector('[data-browse-view]'))`,
    pathname,
  );
}

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});

await navigate("/resources");
const defaultFilterAudit = await evaluate(`(() => ({
  values: [...document.querySelectorAll('select')].map((select) => select.value),
  labels: [...document.querySelectorAll('select')].map((select) => select.selectedOptions[0]?.textContent.trim()),
}))()`);
assert.deepEqual(defaultFilterAudit.values, ["", "", "", "curated"]);
assert.deepEqual(defaultFilterAudit.labels, [
  "All categories",
  "All access models",
  "All source types",
  "Curated order",
]);
const cardAudit = await evaluate(`(() => ({
  cards: document.querySelectorAll('[data-browse-view=cards] article').length,
  internalLinks: [...document.querySelectorAll('[data-browse-view=cards] article > a')]
    .every((link) => link.getAttribute('href')?.startsWith('/resources/')),
  providerLinks: document.querySelectorAll('[data-browse-view=cards] a[target=_blank][rel="noopener noreferrer"]').length,
  saves: document.querySelectorAll('[data-browse-view=cards] button[aria-pressed]').length,
  nextHref: [...document.querySelectorAll('nav[aria-label="Browse pages"] a')]
    .find((link) => link.textContent.trim() === 'Next')?.getAttribute('href'),
  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
}))()`);
assert.equal(cardAudit.cards, 24);
assert.equal(cardAudit.internalLinks, true);
assert.ok(cardAudit.providerLinks > 0);
assert.equal(cardAudit.saves, 24);
assert.match(cardAudit.nextHref, /page=2/);
assert.equal(cardAudit.overflow, false);

await navigate("/resources?view=list&profileLevel=profiled&page=2");
assert.equal(
  await evaluate(
    `document.querySelectorAll('[data-browse-view=cards] article').length`,
  ),
  24,
);
assert.equal(
  await evaluate(
    `document.querySelector('[data-browse-view=cards] a')?.getAttribute('href')?.startsWith('/resources/')`,
  ),
  true,
);

await send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});

await navigate("/resources?category=website-inspiration&sort=name-asc");
const mobileFilterAudit = await evaluate(`(() => ({
  trigger: document.querySelector('[data-browse-filter-trigger]')?.textContent.trim(),
  layer: document.querySelector('[data-browse-filter-layer]')?.getAttribute('data-browse-filter-layer'),
  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
}))()`);
assert.equal(mobileFilterAudit.trigger, "Filter (2 active)");
assert.equal(mobileFilterAudit.layer, "closed");
assert.equal(mobileFilterAudit.overflow, false);

await evaluate(
  "document.querySelector('[data-browse-filter-trigger]')?.click()",
);
await waitFor(
  `document.querySelector('[data-browse-filter-layer]')?.getAttribute('data-browse-filter-layer') === 'open'`,
  "mobile Browse filter sheet",
);
await waitFor(
  "document.querySelector('[data-browse-filter-sheet]')?.contains(document.activeElement)",
  "mobile Browse filter focus",
);
const mobileFilterOpenAudit = await evaluate(`(() => ({
  dialog: document.querySelector('[data-browse-filter-sheet]')?.getAttribute('role'),
  bodyOverflow: document.body.style.overflow,
  focusInside: document.querySelector('[data-browse-filter-sheet]')?.contains(document.activeElement),
  closeSize: (() => {
    const rect = document.querySelector('[aria-label="Close filters"]')?.getBoundingClientRect();
    return rect ? { width: rect.width, height: rect.height } : null;
  })(),
}))()`);
assert.equal(mobileFilterOpenAudit.dialog, "dialog");
assert.equal(mobileFilterOpenAudit.bodyOverflow, "hidden");
assert.equal(mobileFilterOpenAudit.focusInside, true);
assert.deepEqual(mobileFilterOpenAudit.closeSize, { width: 44, height: 44 });

await pressKey({ code: "Escape", key: "Escape", virtualKeyCode: 27 });
await waitFor(
  `document.querySelector('[data-browse-filter-layer]')?.getAttribute('data-browse-filter-layer') === 'closed'`,
  "mobile Browse filter close",
);
await waitFor(
  "document.activeElement?.matches('[data-browse-filter-trigger]')",
  "mobile Browse filter focus restoration",
);

await navigate("/resources?view=table&profileLevel=verified");
const mobileCardAudit = await evaluate(`(() => ({
  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  cards: document.querySelectorAll('[data-browse-view=cards] article').length,
}))()`);
assert.equal(mobileCardAudit.overflow, false);
assert.equal(mobileCardAudit.cards, 24);

for (const [width, height] of [
  [1024, 768],
  [768, 1024],
  [320, 844],
]) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width <= 390,
  });
  await navigate("/resources?q=motion");
  const responsiveAudit = await evaluate(`(() => ({
    cards: document.querySelectorAll('[data-browse-view=cards] article').length,
    hasHeading: Boolean(document.querySelector('h1')),
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }))()`);
  assert.equal(responsiveAudit.cards > 0, true, `Browse cards at ${width}px`);
  assert.equal(
    responsiveAudit.hasHeading,
    true,
    `Browse heading at ${width}px`,
  );
  assert.equal(
    responsiveAudit.overflow,
    false,
    `Browse overflow at ${width}px`,
  );
}

await send("Page.navigate", { url: `${origin}/resources?sort=verified` });
await waitFor(
  `document.readyState === "complete" && Boolean(document.querySelector('[data-browse-view=cards]'))`,
  "legacy verification sort",
);
assert.equal(
  await evaluate(`new URLSearchParams(window.location.search).get('sort')`),
  "verified",
);
assert.equal(
  await evaluate(`document.querySelector('select[name=sort]')?.value`),
  "curated",
);

await send("Page.navigate", { url: `${origin}/resources/designindex` });
await waitFor(
  `document.readyState === "complete" && Boolean(document.querySelector('[data-source-detail=designindex]'))`,
  "internal source profile",
);
assert.equal(
  await evaluate(`document.querySelector('h1')?.textContent.trim()`),
  "DesignIndex",
);

socket.close();
console.log("Canonical Browse browser checks passed.");
