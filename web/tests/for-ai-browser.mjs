import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const endpoint = process.env.CDP_ENDPOINT ?? "http://127.0.0.1:9222";
const origin = process.env.TESSLI_ORIGIN ?? "http://127.0.0.1:3000";
const outputDirectory = new URL("../artifacts/for-ai/", import.meta.url);
const pending = new Map();
let messageId = 0;
const browserFailures = [];

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
  if (message.method === "Runtime.exceptionThrown") {
    browserFailures.push(message.params.exceptionDetails.text);
  }
  if (
    message.method === "Runtime.consoleAPICalled" &&
    message.params.type === "error"
  ) {
    browserFailures.push(
      message.params.args
        .map((argument) => argument.value ?? argument.description ?? "error")
        .join(" "),
    );
  }
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
    if (await evaluate(expression)) return;
    await delay(50);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

async function navigate(pathname, readyExpression) {
  await send("Page.navigate", { url: `${origin}${pathname}` });
  await waitFor(
    `document.readyState === "complete" && (${readyExpression})`,
    pathname,
  );
}

async function setViewport(width, height, mobile) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
  });
}

async function screenshot(filename) {
  const image = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  await writeFile(
    new URL(filename, outputDirectory),
    Buffer.from(image.data, "base64"),
  );
}

await mkdir(outputDirectory, { recursive: true });
await Promise.all([send("Page.enable"), send("Runtime.enable")]);

await setViewport(1440, 900, false);
await navigate(
  "/for-ai",
  'document.querySelectorAll("[data-for-ai-page] .toolCard").length === 5 || document.querySelectorAll("[data-for-ai-page] ol li code").length >= 5',
);

assert.equal(await evaluate('document.querySelectorAll("main").length'), 1);
assert.equal(await evaluate('document.querySelectorAll("h1").length'), 1);
assert.equal(
  await evaluate(
    'document.querySelector("nav[aria-label=\\"Primary navigation\\"] a[aria-current=\\"page\\"]")?.textContent?.trim()',
  ),
  "For AI",
);
assert.equal(
  await evaluate(
    'Array.from(document.querySelectorAll("#mcp-tools code")).filter((node) => node.textContent?.includes("_")).length',
  ),
  5,
);
assert.equal(
  await evaluate(
    'document.body.textContent.includes("255") && document.body.textContent.includes("40") && document.body.textContent.includes("None currently meet the full contract")',
  ),
  true,
);
assert.equal(
  await evaluate('document.querySelectorAll("a a, a button, button a").length'),
  0,
);
assert.equal(
  await evaluate('document.querySelectorAll("pre[tabindex=\\"0\\"]").length'),
  2,
);
assert.equal(
  await evaluate("document.documentElement.scrollWidth <= window.innerWidth"),
  true,
);

const representationStatuses = await evaluate(`Promise.all([
  "/resources/landingfolio/profile.json",
  "/resources/landingfolio/profile.md",
  "/collections/saas-landing-pages/collection.json",
  "/collections/saas-landing-pages/collection.md"
].map(async (pathname) => {
  const response = await fetch(pathname);
  return [pathname, response.status, response.headers.get("content-type")];
}))`);
assert.deepEqual(
  representationStatuses.map((entry) => entry[1]),
  [200, 200, 200, 200],
);
assert.match(representationStatuses[0][2], /application\/json/);
assert.match(representationStatuses[1][2], /text\/markdown/);
assert.match(representationStatuses[2][2], /application\/json/);
assert.match(representationStatuses[3][2], /text\/markdown/);
await screenshot("for-ai-1440x900.png");

for (const [width, height, mobile] of [
  [1024, 768, false],
  [768, 1024, false],
  [390, 844, true],
  [320, 800, true],
]) {
  await setViewport(width, height, mobile);
  await navigate(
    "/for-ai",
    'Boolean(document.querySelector("[data-for-ai-page]"))',
  );
  assert.equal(
    await evaluate("document.documentElement.scrollWidth <= window.innerWidth"),
    true,
    `For AI should not overflow at ${width}px.`,
  );
  assert.equal(
    await evaluate(
      'getComputedStyle(document.querySelector("#mcp-tools ol")).gridTemplateColumns.split(" ").length',
    ),
    width < 768 ? 1 : 2,
    `Tool list should recompose at ${width}px.`,
  );
  assert.equal(
    await evaluate(
      'Array.from(document.querySelectorAll("pre")).every((node) => node.scrollWidth >= node.clientWidth && node.getBoundingClientRect().right <= window.innerWidth)',
    ),
    true,
  );

  if (width === 390) {
    await screenshot("for-ai-390x844.png");
  }
}

socket.close();
assert.deepEqual(browserFailures, []);
console.log(
  "For AI route, representations, responsive layout, and boundaries passed.",
);
