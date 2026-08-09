import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const endpoint = process.env.CDP_ENDPOINT ?? "http://127.0.0.1:9222";
const origin = process.env.TESSLI_ORIGIN ?? "http://127.0.0.1:3000";
const outputDirectory = new URL(
  "../artifacts/search-browser/",
  import.meta.url,
);
const catalogue = JSON.parse(
  await readFile(new URL("../data/catalogue.json", import.meta.url), "utf8"),
);
const firstResource = catalogue.resources[0];
const secondResource = catalogue.resources[1];
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
  if (response.exceptionDetails)
    throw new Error(response.exceptionDetails.text);
  return response.result.value;
}

async function waitFor(expression, label, timeout = 7_500) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return;
    await delay(50);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

await mkdir(outputDirectory, { recursive: true });
await send("Page.enable");
await send("Page.navigate", { url: `${origin}/` });
await waitFor(
  "Boolean(document.querySelector('[data-home-task-entry]'))",
  "Home",
);
await evaluate(
  `localStorage.clear(); localStorage.setItem('mosaicary-saved-resources-v1', JSON.stringify([${JSON.stringify(firstResource.url)}])); localStorage.setItem('tessli-saved-resource-ids-v2', JSON.stringify([${JSON.stringify(firstResource.id)}, ${JSON.stringify(secondResource.id)}])); true`,
);
await send("Page.navigate", { url: `${origin}/saved` });
await waitFor(
  "document.querySelectorAll('[data-saved-resource-grid] [data-resource-card]').length === 2",
  "saved cards",
);
assert.deepEqual(
  await evaluate(
    "Array.from(document.querySelectorAll('[data-saved-resource-grid] [data-resource-card]')).map((card) => card.getAttribute('data-resource-slug'))",
  ),
  [secondResource.slug, firstResource.slug],
);

await evaluate("document.querySelector('[data-clear-saved]').click(); true");
await waitFor(
  "Boolean(document.querySelector('dialog[open]'))",
  "clear confirmation",
);
await send("Input.dispatchKeyEvent", {
  type: "keyDown",
  key: "Escape",
  code: "Escape",
});
await waitFor("!document.querySelector('dialog[open]')", "closed confirmation");
await waitFor(
  "Boolean(document.activeElement?.matches('[data-clear-saved]'))",
  "clear trigger focus return",
);

await evaluate("document.querySelector('[data-clear-saved]').click(); true");
await waitFor(
  "Boolean(document.querySelector('dialog[open]'))",
  "second clear confirmation",
);
await evaluate(
  "document.querySelector('[data-confirm-clear-saved]').click(); true",
);
await waitFor(
  "Boolean(document.querySelector('[data-saved-resources-empty]'))",
  "empty saved state",
);
assert.equal(
  await evaluate("localStorage.getItem('tessli-saved-resource-ids-v2')"),
  "[]",
);
await evaluate(
  "document.querySelector('[data-undo-clear-saved]').click(); true",
);
await waitFor(
  "document.querySelectorAll('[data-saved-resource-grid] [data-resource-card]').length === 2",
  "undo restored cards",
);
assert.equal(
  await evaluate(
    "document.querySelector('[data-saved-resource-grid] [data-resource-card]')?.getAttribute('data-resource-slug')",
  ),
  secondResource.slug,
);

await evaluate("document.querySelector('[data-clear-saved]').click(); true");
await waitFor(
  "Boolean(document.querySelector('dialog[open]'))",
  "third clear confirmation",
);
await evaluate(
  "document.querySelector('[data-confirm-clear-saved]').click(); true",
);
await waitFor(
  "Boolean(document.querySelector('[data-saved-resources-empty]'))",
  "second empty saved state",
);
await send("Page.reload", { ignoreCache: true });
await waitFor(
  "Boolean(document.querySelector('[data-saved-resources-empty]'))",
  "persistent empty state",
);

await send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await send("Page.navigate", { url: `${origin}/auth` });
await waitFor(
  "Boolean(document.querySelector('[data-auth-shell=ready]'))",
  "credential-ready auth shell",
);
await waitFor("document.fonts.status === 'loaded'", "auth shell fonts");
const authAudit = await evaluate(`(() => {
  const shell = document.querySelector('[data-auth-shell=ready]');
  const fieldset = shell?.querySelector('fieldset');
  const controls = [...(fieldset?.querySelectorAll('button, input') ?? [])];
  return {
    configuration: shell?.getAttribute('data-auth-configuration'),
    controlsDisabled:
      controls.length === 3 && controls.every((control) => control.matches(':disabled')),
    fieldsetDisabled: Boolean(fieldset?.disabled),
    localSaves: localStorage.getItem('tessli-saved-resource-ids-v2'),
    noSubmitCopy: document.body.textContent.includes(
      'No sign-in request is sent from this page yet',
    ),
    overflow:
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  };
})()`);
assert.deepEqual(authAudit, {
  configuration: "unconfigured",
  controlsDisabled: true,
  fieldsetDisabled: true,
  localSaves: "[]",
  noSubmitCopy: true,
  overflow: false,
});
const authScreenshot = await send("Page.captureScreenshot", {
  format: "png",
  fromSurface: true,
  captureBeyondViewport: false,
});
await writeFile(
  new URL("auth-shell-390x844.png", outputDirectory),
  Buffer.from(authScreenshot.data, "base64"),
);

socket.close();
console.log("Saved resource and credential-ready auth interactions passed.");
