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

async function waitFor(expression, label, timeout = 10_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return;
    await delay(75);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

await send("Page.enable");
await send("Runtime.enable");
await send("Page.navigate", { url: `${origin}/` });
await waitFor(
  `document.readyState === "complete" && Boolean(document.querySelector('[data-home-task-entry]'))`,
  "Home task entry",
);

const audit = await evaluate(`(() => ({
  taskLinks: document.querySelectorAll('[data-home-task-entry] a[href^="/resources?q="]').length,
  collections: document.querySelectorAll('[data-home-task-entry] [data-collection-card]').length,
  forAiHref: document.querySelector('[data-home-task-entry] a[href="/for-ai"]')?.getAttribute('href'),
  hasPreview: Boolean(document.querySelector('[data-resource-grid]')),
  hasCategoryControls: Boolean(document.querySelector('[data-discovery-category]')),
  searchAction: document.querySelector('form[aria-label="Search Tessli resources"]')?.getAttribute('action'),
  searchName: document.querySelector('[data-explore-search-input]')?.getAttribute('name'),
  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
}))()`);

assert.equal(audit.taskLinks, 6);
assert.equal(audit.collections, 3);
assert.equal(audit.forAiHref, "/for-ai");
assert.equal(audit.hasPreview, false);
assert.equal(audit.hasCategoryControls, false);
assert.equal(audit.searchAction, "/resources");
assert.equal(audit.searchName, "q");
assert.equal(audit.overflow, false);

socket.close();
console.log("Home task entry browser checks passed.");
