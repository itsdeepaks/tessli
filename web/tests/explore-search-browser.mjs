import assert from "node:assert/strict";

const endpoint = process.env.CDP_ENDPOINT ?? "http://127.0.0.1:9222";
const pageUrl = process.env.TESSLI_URL ?? "http://127.0.0.1:3000/";
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

async function waitFor(expression, label) {
  const deadline = Date.now() + 5_000;

  while (Date.now() < deadline) {
    if (await evaluate(expression)) {
      return;
    }

    await delay(50);
  }

  throw new Error(`Timed out waiting for ${label}.`);
}

async function pressKey({ code, key, modifiers = 0, virtualKeyCode }) {
  const params = {
    code,
    key,
    modifiers,
    nativeVirtualKeyCode: virtualKeyCode,
    windowsVirtualKeyCode: virtualKeyCode,
  };

  await send("Input.dispatchKeyEvent", { ...params, type: "keyDown" });
  await send("Input.dispatchKeyEvent", { ...params, type: "keyUp" });
}

async function pressKeyUntil(keyOptions, expression, label) {
  const deadline = Date.now() + 5_000;

  while (Date.now() < deadline) {
    await pressKey(keyOptions);
    if (await evaluate(expression)) {
      return;
    }
    await delay(100);
  }

  throw new Error(`Timed out waiting for ${label}.`);
}

await send("Page.enable");
await send("Runtime.enable");
await send("Page.navigate", { url: pageUrl });
await waitFor(
  'document.readyState === "complete" && Boolean(document.querySelector("[data-explore-search-input]"))',
  "the Explore search input",
);

await pressKeyUntil(
  {
    code: "KeyK",
    key: "k",
    modifiers: 2,
    virtualKeyCode: 75,
  },
  'document.activeElement?.hasAttribute("data-explore-search-input") === true',
  "Ctrl/Cmd + K focus",
);

await send("Input.insertText", { text: "motion" });
await waitFor(
  'document.querySelector("[data-explore-search-input]")?.value === "motion"',
  "search text entry",
);
await waitFor(
  `(() => {
    const input = document.querySelector('[data-explore-search-input]');
    const status = document.getElementById(input?.getAttribute('aria-describedby'));
    return status?.textContent.trim() === 'Search query entered.';
  })()`,
  "the search query announcement",
);
assert.equal(
  await evaluate('Boolean(document.querySelector("[data-search-clear]"))'),
  true,
  "A populated query should expose the clear control.",
);

await pressKey({ code: "Escape", key: "Escape", virtualKeyCode: 27 });
await waitFor(
  'document.querySelector("[data-explore-search-input]")?.value === ""',
  "first Escape to clear",
);
assert.equal(
  await evaluate(
    'document.activeElement?.hasAttribute("data-explore-search-input") === true',
  ),
  true,
  "The first Escape should preserve input focus.",
);

await pressKey({ code: "Escape", key: "Escape", virtualKeyCode: 27 });
await waitFor(
  'document.activeElement?.hasAttribute("data-explore-search-input") !== true',
  "second Escape to blur",
);

await pressKey({ code: "Slash", key: "/", virtualKeyCode: 191 });
await waitFor(
  'document.activeElement?.hasAttribute("data-explore-search-input") === true',
  "slash shortcut focus",
);
await send("Input.insertText", { text: "type" });
await waitFor(
  'document.querySelector("[data-explore-search-input]")?.value === "type"',
  "second search text entry",
);
await evaluate('document.querySelector("[data-search-clear]")?.click()');
await waitFor(
  'document.querySelector("[data-explore-search-input]")?.value === ""',
  "clear-button behaviour",
);
assert.equal(
  await evaluate(
    'document.activeElement?.hasAttribute("data-explore-search-input") === true',
  ),
  true,
  "The clear button should return focus to the input.",
);

const facts = await evaluate(`Array.from(
  document.querySelectorAll('[aria-label="Tessli catalogue facts"] li')
).map((item) => ({
  value: item.querySelector('strong')?.textContent?.trim(),
  label: item.querySelector('strong + span')?.textContent?.trim(),
}))`);

assert.deepEqual(facts, [
  { label: "Curated resources", value: "295" },
  { label: "Practical categories", value: "11" },
  { label: "Browser-local saves", value: "Private" },
  { label: "Community-built project", value: "Open" },
]);

socket.close();
console.log("Explore search browser interaction checks passed.");
