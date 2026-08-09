import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const endpoint = process.env.CDP_ENDPOINT ?? "http://127.0.0.1:9222";
const origin = process.env.TESSLI_ORIGIN ?? "http://127.0.0.1:3000";
const outputDirectory = new URL(
  "../artifacts/phase-1-release/",
  import.meta.url,
);
const catalogue = JSON.parse(
  await readFile(new URL("../data/catalogue.json", import.meta.url), "utf8"),
);
const boardSeed = [
  {
    id: "release-board",
    name: "Release research pack",
    goal: "Verify the browser-local Board export workflow.",
    audience: "Tessli researchers and model users.",
    constraints: "Local-only, deterministic, accessible, and responsive.",
    unresolvedQuestions: ["Does the exported context remain compact?"],
    createdAt: "2026-08-04T00:00:00.000Z",
    updatedAt: "2026-08-04T00:00:00.000Z",
    items: [
      {
        resourceId: catalogue.resources[0].id,
        note: "Inspect the hierarchy and source boundaries.",
        decision: "selected",
        rationale: "Useful for validating the export path.",
      },
      {
        resourceId: catalogue.resources[1].id,
        note: "Retain the rejected direction in project context.",
        decision: "rejected",
        rationale: "Not appropriate for this verification task.",
      },
    ],
  },
];

const viewports = [
  [1440, 900],
  [1280, 800],
  [1024, 768],
  [768, 1024],
  [430, 932],
  [390, 844],
  [360, 800],
];

const routeChecks = [
  ["/", 200, "Find better design resources, faster"],
  ["/collections", 200, "Six staged collections"],
  ["/collections/saas-landing-pages", 200, "SaaS landing-page references"],
  ["/collections/typography-font-tools", 200, "Typography and font tools"],
  ["/collections/motion-starter-pack", 200, "Motion starter pack"],
  ["/collections/open-source-ui-libraries", 200, "Open-source UI libraries"],
  ["/collections/accessible-colour-tools", 200, "Accessible colour tools"],
  [
    "/collections/design-systems-worth-studying",
    200,
    "Design systems worth studying",
  ],
  ["/resources", 200, "What are you trying to design?"],
  ["/resources/designindex", 200, "How to access it"],
  ["/saved", 200, "Search and refine the references kept in this browser"],
  ["/boards", 200, "Project boards"],
  ["/about", 200, "Keep reading"],
  ["/curation", 200, "Keep reading"],
  ["/privacy", 200, "Keep reading"],
  ["/terms", 200, "Keep reading"],
  ["/content-policy", 200, "Keep reading"],
  ["/submit", 200, "What this route does today"],
  ["/suggest", 200, "What this route does today"],
  ["/auth", 200, "Account access unavailable"],
  ["/collections/not-a-real-collection", 404, "Page not found"],
  ["/a-clearly-missing-route", 404, "Page not found"],
];

for (const [path, expectedStatus, expectedText] of routeChecks) {
  const response = await fetch(`${origin}${path}`);
  const body = await response.text();
  assert.equal(response.status, expectedStatus, `${path} status`);
  assert.match(body, new RegExp(expectedText, "i"), `${path} content`);
}

const machineRouteChecks = [
  {
    path: "/resources/designindex/profile.json",
    contentType: "application/json",
    expectedText: '"contract": "tessli.public-source.v1"',
  },
  {
    path: "/resources/designindex/profile.md",
    contentType: "text/markdown",
    expectedText: "# Tessli Source Profile — DesignIndex",
  },
  {
    path: "/collections/saas-landing-pages/collection.json",
    contentType: "application/json",
    expectedText: '"contract": "tessli.public-playbook.v2"',
  },
  {
    path: "/collections/saas-landing-pages/collection.md",
    contentType: "text/markdown",
    expectedText: "# Tessli Playbook — SaaS landing-page references",
  },
];

for (const check of machineRouteChecks) {
  const response = await fetch(`${origin}${check.path}`);
  const body = await response.text();
  assert.equal(response.status, 200, `${check.path} status`);
  assert.match(
    response.headers.get("content-type") ?? "",
    new RegExp(`^${check.contentType}`),
    `${check.path} content type`,
  );
  assert.equal(
    response.headers.get("access-control-allow-origin"),
    "*",
    `${check.path} CORS`,
  );
  assert.equal(
    response.headers.get("x-content-type-options"),
    "nosniff",
    `${check.path} nosniff`,
  );
  assert.match(
    response.headers.get("link") ?? "",
    /rel="canonical"/u,
    `${check.path} canonical link`,
  );
  assert.match(body, new RegExp(check.expectedText, "i"), `${check.path} body`);
}

const visualCases = [
  { name: "home", path: "/", selector: "[data-home-task-entry]" },
  {
    name: "collections",
    path: "/collections",
    selector: "[data-collections-grid]",
  },
  {
    name: "collection-detail",
    path: "/collections/saas-landing-pages",
    selector: "[data-collection-detail=saas-landing-pages]",
  },
  {
    name: "browse",
    path: "/resources",
    selector: "[data-browse-view=cards]",
    browse: true,
  },
  {
    name: "saved",
    path: "/saved",
    selector: "[data-saved-resources-page=true]",
    saved: true,
  },
  {
    name: "boards",
    path: "/boards",
    selector: "#board-export-title",
    boards: true,
  },
  { name: "about", path: "/about", selector: "#main-content article" },
  {
    name: "auth",
    path: "/auth",
    selector: "[data-auth-shell=ready]",
    auth: true,
  },
  {
    name: "contribution-guidance",
    path: "/submit",
    selector: "#main-content",
  },
  { name: "not-found", path: "/a-clearly-missing-route", selector: "main" },
];

const pending = new Map();
let messageId = 0;
const consoleFailures = [];

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
    consoleFailures.push(message.params.exceptionDetails.text);
  }
  if (
    message.method === "Runtime.consoleAPICalled" &&
    message.params.type === "error"
  ) {
    consoleFailures.push(
      message.params.args
        .map(
          (argument) =>
            argument.value ?? argument.description ?? "console error",
        )
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

await mkdir(outputDirectory, { recursive: true });
await send("Page.enable");
await send("Runtime.enable");

for (const [width, height] of viewports) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width <= 430,
  });

  for (const visualCase of visualCases) {
    if (visualCase.saved || visualCase.boards) {
      await send("Page.navigate", { url: `${origin}/` });
      await waitFor(
        "document.readyState === 'complete'",
        `${visualCase.name} seed page`,
      );
    }

    if (visualCase.saved) {
      await evaluate(
        `localStorage.setItem('tessli-saved-resource-ids-v2', JSON.stringify([${JSON.stringify(catalogue.resources[0].id)}, ${JSON.stringify(catalogue.resources[1].id)}])); true`,
      );
    }

    if (visualCase.boards) {
      await evaluate(
        `localStorage.setItem('tessli-project-boards-v1', ${JSON.stringify(JSON.stringify(boardSeed))}); true`,
      );
    }

    await send("Page.navigate", { url: `${origin}${visualCase.path}` });
    await waitFor(
      "document.readyState === 'complete'",
      `${visualCase.name} document`,
    );
    await waitFor(
      `Boolean(document.querySelector(${JSON.stringify(visualCase.selector)}))`,
      `${visualCase.name} marker`,
    );
    await waitFor(
      "document.fonts.status === 'loaded'",
      `${visualCase.name} fonts`,
    );

    const audit = await evaluate(`(() => ({
      hasMain: Boolean(document.querySelector('main')),
      hasHeading: Boolean(document.querySelector('h1')),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      title: document.title,
    }))()`);
    assert.equal(audit.hasMain, true, `${visualCase.name} main at ${width}`);
    assert.equal(audit.hasHeading, true, `${visualCase.name} h1 at ${width}`);
    assert.equal(
      audit.overflow,
      false,
      `${visualCase.name} overflow at ${width}`,
    );
    assert.ok(audit.title.length > 0, `${visualCase.name} title at ${width}`);

    if (visualCase.browse) {
      const browseAudit = await evaluate(`(() => ({
        cards: document.querySelectorAll('[data-browse-view=cards] article').length,
        internalLinks: [...document.querySelectorAll('[data-browse-view=cards] article > a')]
          .every((link) => link.getAttribute('href')?.startsWith('/resources/')),
        providerLinks: document.querySelectorAll('[data-browse-view=cards] a[target=_blank]').length,
        saveButtons: document.querySelectorAll('[data-browse-view=cards] button[aria-pressed]').length,
      }))()`);
      assert.equal(browseAudit.cards, 24, `Browse card page size at ${width}`);
      assert.equal(
        browseAudit.internalLinks,
        true,
        `Browse primary links at ${width}`,
      );
      assert.ok(
        browseAudit.providerLinks > 0,
        `Browse provider links at ${width}`,
      );
      assert.equal(browseAudit.saveButtons, 24, `Browse saves at ${width}`);
    }

    if (visualCase.boards) {
      const boardAudit = await evaluate(`(() => {
        const section = document.querySelector('[aria-labelledby=board-export-title]');
        const buttons = [...(section?.querySelectorAll('button') ?? [])];
        const date = section?.querySelector('input[type=date]');
        const audience = [...document.querySelectorAll('label span')]
          .find((label) => label.textContent === 'Audience')
          ?.parentElement?.querySelector('textarea');
        return {
          audience: audience?.value,
          buttonsEnabled:
            buttons.length === 2 && buttons.every((button) => !button.disabled),
          buttonLabels: buttons.map((button) => button.textContent?.trim()),
          dateValue: date?.value,
          localOnlyCopy: section?.textContent?.includes(
            'Board content stays in this browser and is not uploaded',
          ),
          readyCopy: section?.textContent?.includes('Ready: 1 selected reference'),
        };
      })()`);
      assert.equal(
        boardAudit.audience,
        boardSeed[0].audience,
        `Board audience at ${width}`,
      );
      assert.equal(
        boardAudit.buttonsEnabled,
        true,
        `Board export controls enabled at ${width}`,
      );
      assert.deepEqual(
        boardAudit.buttonLabels,
        ["Copy Markdown", "Download .md"],
        `Board export labels at ${width}`,
      );
      assert.match(
        boardAudit.dateValue ?? "",
        /^\d{4}-\d{2}-\d{2}$/u,
        `Board generated date at ${width}`,
      );
      assert.equal(
        boardAudit.localOnlyCopy,
        true,
        `Board local-only copy at ${width}`,
      );
      assert.equal(boardAudit.readyCopy, true, `Board ready state at ${width}`);
    }

    if (visualCase.auth) {
      const authAudit = await evaluate(`(() => {
        const shell = document.querySelector('[data-auth-shell=ready]');
        const fieldset = shell?.querySelector('fieldset');
        const controls = [...(fieldset?.querySelectorAll('button, input') ?? [])];
        return {
          configuration: shell?.getAttribute('data-auth-configuration'),
          controlsDisabled:
            controls.length === 3 && controls.every((control) => control.matches(':disabled')),
          fieldsetDisabled: Boolean(fieldset?.disabled),
          noSubmitCopy: document.body.textContent.includes(
            'No sign-in request is sent from this page yet',
          ),
        };
      })()`);
      assert.equal(
        authAudit.configuration,
        "unconfigured",
        `auth configuration at ${width}`,
      );
      assert.equal(
        authAudit.fieldsetDisabled,
        true,
        `auth fieldset disabled at ${width}`,
      );
      assert.equal(
        authAudit.controlsDisabled,
        true,
        `auth controls disabled at ${width}`,
      );
      assert.equal(
        authAudit.noSubmitCopy,
        true,
        `auth no-submit copy at ${width}`,
      );
    }

    const screenshot = await send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: false,
    });
    await writeFile(
      new URL(`${visualCase.name}-${width}x${height}.png`, outputDirectory),
      Buffer.from(screenshot.data, "base64"),
    );
  }
}

await send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await send("Page.navigate", { url: `${origin}/` });
await waitFor(
  "document.readyState === 'complete'",
  "Explore before empty Saved",
);
await evaluate(
  "localStorage.setItem('tessli-saved-resource-ids-v2', '[]'); true",
);
await send("Page.navigate", { url: `${origin}/saved` });
await waitFor(
  "Boolean(document.querySelector('[data-saved-resources-empty]'))",
  "empty Saved state",
);
const emptyScreenshot = await send("Page.captureScreenshot", {
  format: "png",
  fromSurface: true,
  captureBeyondViewport: false,
});
await writeFile(
  new URL("saved-empty-390x844.png", outputDirectory),
  Buffer.from(emptyScreenshot.data, "base64"),
);

socket.close();
assert.deepEqual(
  consoleFailures,
  [],
  `Browser errors: ${consoleFailures.join(" | ")}`,
);
console.log("Phase 1 release route and viewport matrix passed.");
