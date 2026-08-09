import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const endpoint = process.env.CDP_ENDPOINT ?? "http://127.0.0.1:9222";
const origin = process.env.TESSLI_ORIGIN ?? "http://127.0.0.1:3000";
const savedResourceStoreKey = "tessli-saved-resource-ids-v2";
const catalogue = JSON.parse(
  await readFile(new URL("../data/catalogue.json", import.meta.url), "utf8"),
);
const resource = catalogue.resources.find(
  (candidate) => candidate.slug === "motion",
);

assert.ok(
  resource,
  "The Motion fixture must remain in the canonical catalogue.",
);

const profilePath = `/resources/${resource.slug}`;
const collectionPath = "/collections/motion-starter-pack";
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

async function waitFor(expression, label, timeout = 10_000) {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    if (await evaluate(expression)) {
      return;
    }

    await delay(75);
  }

  throw new Error(`Timed out waiting for ${label}.`);
}

function cardSelector() {
  return `[data-resource-card][data-resource-slug=${JSON.stringify(resource.slug)}]`;
}

async function navigate(pathname, label) {
  await send("Page.navigate", { url: `${origin}${pathname}` });
  await waitFor(
    `document.readyState === "complete" && Boolean(document.querySelector(${JSON.stringify(cardSelector())}))`,
    label,
  );
}

async function setViewport(width) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height: width <= 390 ? 844 : 1000,
    deviceScaleFactor: 1,
    mobile: width <= 390,
  });
}

async function assertCardActions(surface) {
  const audit = await evaluate(`(() => {
    const card = document.querySelector(${JSON.stringify(cardSelector())});
    const links = Array.from(card?.querySelectorAll("a") ?? []);
    const inspect = links.find(
      (link) => link.getAttribute("href") === ${JSON.stringify(profilePath)},
    );
    const visit = card?.querySelector("[data-resource-visit]");

    return {
      inspect: inspect
        ? {
            href: inspect.getAttribute("href"),
            target: inspect.getAttribute("target"),
          }
        : null,
      visit: visit
        ? {
            href: visit.getAttribute("href"),
            rel: visit.getAttribute("rel"),
            target: visit.getAttribute("target"),
          }
        : null,
      save: card?.querySelector("[data-resource-save]")?.getAttribute("aria-pressed"),
    };
  })()`);

  assert.deepEqual(
    audit.inspect,
    { href: profilePath, target: null },
    `${surface} exposes a same-tab internal Tessli profile route.`,
  );
  assert.equal(
    audit.visit?.href,
    resource.url,
    `${surface} keeps Visit pointed at the canonical provider URL.`,
  );
  assert.equal(
    audit.visit?.target,
    "_blank",
    `${surface} keeps Visit independent from internal profile navigation.`,
  );
  assert.equal(
    audit.visit?.rel?.split(/\\s+/).includes("noopener"),
    true,
    `${surface} protects Visit with noopener.`,
  );
  assert.equal(
    audit.visit?.rel?.split(/\\s+/).includes("noreferrer"),
    true,
    `${surface} protects Visit with noreferrer.`,
  );
  assert.notEqual(
    audit.save,
    undefined,
    `${surface} exposes an independent Save control.`,
  );
}

async function assertNoOverflow(pathname, label) {
  await navigate(pathname, label);
  assert.equal(
    await evaluate(
      "document.documentElement.scrollWidth <= document.documentElement.clientWidth",
    ),
    true,
    `${label} does not overflow horizontally.`,
  );
}

await send("Page.enable");
await send("Runtime.enable");
await setViewport(1440);

await navigate("/resources?q=motion", "Browse Motion card");
await assertCardActions("Browse");

await evaluate(
  `document.querySelector(${JSON.stringify(`${cardSelector()} a[href=${JSON.stringify(profilePath)}]`)})?.click(); true`,
);
await waitFor(
  `window.location.pathname === ${JSON.stringify(profilePath)}`,
  "Browse Inspect navigation",
);
await navigate("/resources?q=motion", "Browse Motion card after Inspect");

const browseLocation = await evaluate("window.location.href");
await evaluate(
  `document.querySelector(${JSON.stringify(`${cardSelector()} [data-resource-save]`)})?.click(); true`,
);
await waitFor(
  `document.querySelector(${JSON.stringify(`${cardSelector()} [data-resource-save]`)})?.getAttribute("aria-pressed") === "true"`,
  "Browse Save state",
);
assert.equal(
  await evaluate("window.location.href"),
  browseLocation,
  "Browse Save does not navigate away from the page.",
);
assert.equal(
  await evaluate(
    `JSON.parse(localStorage.getItem(${JSON.stringify(savedResourceStoreKey)}) ?? "[]").includes(${JSON.stringify(resource.id)})`,
  ),
  true,
  "Browse Save writes the stable resource ID to browser-local storage.",
);

await navigate(collectionPath, "Motion collection card");
await assertCardActions("Collection detail");
assert.equal(
  await evaluate(
    `document.querySelector(${JSON.stringify(`${cardSelector()} [data-resource-save]`)})?.getAttribute("aria-pressed")`,
  ),
  "true",
  "Collection detail reads the same saved result.",
);

await navigate("/saved", "Saved Motion card");
await assertCardActions("Saved");
assert.equal(
  await evaluate(
    `document.querySelector(${JSON.stringify(`${cardSelector()} [data-resource-save]`)})?.getAttribute("aria-pressed")`,
  ),
  "true",
  "Saved renders the browser-local result created from Browse.",
);

for (const width of [1440, 390, 320]) {
  await setViewport(width);
  await assertNoOverflow("/resources?q=motion", `Browse at ${width}px`);
  await assertNoOverflow(collectionPath, `Collection detail at ${width}px`);
  await assertNoOverflow("/saved", `Saved at ${width}px`);
}

socket.close();
console.log(
  "Resource-card parity across Browse, Collections, and Saved passed.",
);
