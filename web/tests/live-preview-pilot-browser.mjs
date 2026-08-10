import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const endpoint = process.env.CDP_ENDPOINT ?? "http://127.0.0.1:9222";
const origin = process.env.TESSLI_ORIGIN ?? "http://127.0.0.1:3000";
const catalogue = JSON.parse(
  await readFile(new URL("../data/catalogue.json", import.meta.url), "utf8"),
);
const otherSource = catalogue.resources.find(
  (resource) => resource.slug !== "shadcn-ui",
);
const pending = new Map();
const browserFailures = [];
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
      // The shared browser may still be starting.
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

await Promise.all([send("Page.enable"), send("Runtime.enable")]);
await send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});

await navigate(
  "/resources/shadcn-ui",
  'Boolean(document.querySelector("[data-source-detail=shadcn-ui] [data-live-preview-pilot]"))',
);

assert.equal(
  await evaluate(
    'document.querySelectorAll("[data-live-preview-frame]").length',
  ),
  0,
  "The provider iframe must not exist before the explicit user gesture.",
);
assert.deepEqual(
  await evaluate(`(() => {
    const section = document.querySelector("[data-live-preview-pilot]");
    const launch = section?.querySelector("[data-live-preview-launch]");
    const visit = document.querySelector('[aria-label="Source actions"] a[target="_blank"]');
    return {
      expanded: launch?.getAttribute("aria-expanded"),
      visitHref: visit?.getAttribute("href"),
      visitTarget: visit?.getAttribute("target"),
      visitRel: visit?.getAttribute("rel"),
    };
  })()`),
  {
    expanded: "false",
    visitHref: "https://ui.shadcn.com",
    visitTarget: "_blank",
    visitRel: "noopener noreferrer",
  },
  "The static Visit action remains available before a live preview opens.",
);

await evaluate(
  'document.querySelector("[data-live-preview-launch]")?.click(); true',
);
await waitFor(
  'document.querySelectorAll("[data-live-preview-frame]").length === 1',
  "the allowlisted live preview iframe",
);
assert.deepEqual(
  await evaluate(`(() => {
    const frame = document.querySelector("[data-live-preview-frame]");
    return {
      allow: frame?.getAttribute("allow"),
      loading: frame?.getAttribute("loading"),
      referrerPolicy: frame?.getAttribute("referrerpolicy"),
      sandbox: frame?.getAttribute("sandbox"),
      src: frame?.getAttribute("src"),
      title: frame?.getAttribute("title"),
    };
  })()`),
  {
    allow: null,
    loading: "lazy",
    referrerPolicy: "no-referrer",
    sandbox: "allow-scripts",
    src: "https://ui.shadcn.com",
    title: "shadcn/ui live preview",
  },
  "The allowlisted iframe stays fully sandboxed without delegated permissions.",
);

assert.equal(
  await evaluate(
    'document.querySelector("[data-live-preview-launch]")?.getAttribute("aria-expanded")',
  ),
  "true",
);
await evaluate(`(() => {
  const close = document.querySelector("[data-live-preview-close]");
  close?.focus();
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  return true;
})()`);
await waitFor(
  'document.querySelectorAll("[data-live-preview-frame]").length === 0',
  "Escape to close the live preview",
);
await waitFor(
  'document.activeElement === document.querySelector("[data-live-preview-launch]")',
  "focus restoration after Escape",
);

await evaluate(
  'document.querySelector("[data-live-preview-launch]")?.click(); true',
);
await waitFor(
  'document.querySelectorAll("[data-live-preview-frame]").length === 1',
  "the reopened live preview iframe",
);
await evaluate(
  'document.querySelector("[data-live-preview-close]")?.click(); true',
);
await waitFor(
  'document.querySelectorAll("[data-live-preview-frame]").length === 0',
  "the close control to remove the live preview",
);
await waitFor(
  'document.activeElement === document.querySelector("[data-live-preview-launch]")',
  "focus restoration after close",
);

await navigate(
  `/resources/${otherSource.slug}`,
  `Boolean(document.querySelector(${JSON.stringify(`[data-source-detail=${otherSource.slug}]`)}))`,
);
assert.equal(
  await evaluate(
    'document.querySelectorAll("[data-live-preview-pilot], iframe").length',
  ),
  0,
  "Every non-allowlisted source keeps the static source-detail experience only.",
);

socket.close();
assert.deepEqual(
  browserFailures,
  [],
  `Browser errors: ${browserFailures.join(" | ")}`,
);
console.log("Live-preview pilot browser checks passed.");
