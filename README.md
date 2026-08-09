# Tessli

Tessli is a **human-curated, AI-native design-source router**. It helps people and coding agents find the right design or frontend source for a task, understand why it fits, choose how to access it, and retain the useful project decisions.

The current 295-source catalogue is the identity layer—not the entire product. Tessli joins:

1. task-led source discovery for people;
2. concise source guidance, previews, limitations, alternatives, and project decisions;
3. machine-readable source data, local MCP, and later remote agent access over the same canonical truth.

Read the authoritative direction and execution plan first:

- [`docs/product-realignment-v3.md`](docs/product-realignment-v3.md)
- [`docs/product-direction.md`](docs/product-direction.md)
- [`PRD.md`](PRD.md)
- [`build-slices.md`](build-slices.md)
- [`AGENTS.md`](AGENTS.md)

`docs/product-realignment-v3.md` is the active V3 implementation map. [`docs/product-plan-v2.md`](docs/product-plan-v2.md) preserves V2 execution evidence only; it is not a second active roadmap.

## Current application baseline

The current application now includes the first reusable Tessli research loop:

- one canonical paginated `/resources` browser;
- truthful internal profiles for all 295 sources;
- 255 Listed, 40 Profiled, and 0 Verified coverage;
- enriched intelligence for the 40 Profiled sources;
- explainable Similar Sources;
- browser-local Saved with search, filters, sorting, removal, and undo;
- browser-local project Boards with goals, audience, constraints, source notes, selected/rejected/undecided decisions, rationale, and unresolved questions;
- deterministic browser-local Markdown research-pack copy and download;
- deterministic public Markdown/JSON for every source and published collection;
- a reproducible Online Scope Studio homepage proof brief, Board, baseline, and research pack;
- an isolated, browser-tested OSS homepage candidate with retained implementation evidence;
- six repository-maintained staged Playbooks;
- a working For AI route documenting current local MCP and public representations;
- public About, curation, privacy, terms, and content-policy pages;
- responsive and browser-tested interaction states.

Authentication, cloud workspaces, submissions, moderation, large pattern catalogues, provider proxying, and public UI-taste claims remain deferred.

## Active V3 execution loop

V3.0 authority reconciliation, V3.1 public IA hygiene, V3.2 AccessRoute pilot, V3.3 Motion source-guide proof, V3.4 Canonical Browse focus, V3.5 Homepage task entry, V3.6 resource-card consistency, V3.7 deterministic task retrieval, and V3.8 local MCP v2 are complete. The next independently reviewable slice is **V3.9 — Public machine representations v2**.

```text
V3.9 Public machine representations v2
→ V3.10 Machine discovery
```

Machine work follows the stable source-guide contract:

```text
V3.7 deterministic task retrieval
→ V3.8 local MCP v2
→ V3.9 compact public representations
→ V3.10 machine discovery
→ V3.16 remote MCP
→ V3.17 supported cross-model validation
```

The full ordered sequence, dependencies, acceptance criteria, and explicit deferrals are in [`docs/product-realignment-v3.md`](docs/product-realignment-v3.md).

## Current V2 baseline

V2 delivered the canonical catalogue, Browse, source profiles, Saved, Boards, public representations, current local MCP, and preserved proof artifacts. Those are the V3 foundation. Historical V2 evidence remains accurate, but it does not define the next implementation slice.

## Source coverage levels

Tessli distinguishes research depth honestly:

- **Listed** — source identity, type, access, description, and status;
- **Profiled** — capabilities, best use cases, content objects, platforms/frameworks, integrations, workflow fit, and limitations;
- **Verified** — evidence, dates, agent-interface details, credential/persistence/redistribution rules, human review, and freshness.

Current canonical baseline:

```text
255 Listed
40 Profiled
0 Verified
```

All 295 sources must not imply equal intelligence depth.

## Model access today

### Without MCP

Tessli supports stable semantic source pages, deterministic Board research packs, and public source/Collection Markdown and JSON that can be searched, shared, pasted, or uploaded to models. V3.9–V3.10 will make these compact, action-oriented, and discoverable.

### With MCP

The repository currently contains five read-only local-MCP-v2 tools:

- `find_sources`;
- `get_source`;
- `find_alternatives`;
- `get_collection`;
- `create_research_brief`.

These tools use deterministic task retrieval, source guidance, alternatives, Collections, and research briefs. A hosted remote MCP does not exist yet; it is deferred to V3.16 after the local contract is stable.

## Boundaries

Tessli does not scrape, proxy, mirror, or redistribute paid/private source content merely because it indexes a provider.

It is not:

- a screenshot piracy archive;
- a universal aesthetic scoring engine;
- an unreviewed AI-generated pattern dump;
- permission to copy another product's interface;
- proof of AI taste based on catalogue size alone.

The UI-taste direction remains a later evidence-backed possibility, not the current public promise.

## Next.js application workspace

The application lives in `web/`.

```powershell
cd web
npm ci
npm run dev
```

Open `http://localhost:3000`.

The developer component lab is available at `http://localhost:3000/lab`. It remains an internal/development surface and should not be treated as a public product route.

Quality commands:

```powershell
npm run format:check
npm run typecheck
npm run lint
npm test
npm run catalogue:check
npm run build
```

Relevant slices may require additional profile, media, coverage, MCP, browser, or release checks.

## Data source

`lib_data/design-resource-library-295.csv` remains traceable as the original release source.

The Next.js workspace consumes deterministic generated catalogue data:

```text
web/data/catalogue.json
web/data/catalogue-validation.json
```

Regenerate and verify from `web/`:

```powershell
npm run catalogue:generate
npm run catalogue:check
```

Normal build and test remain network-free. Generated output records source provenance and fails when committed catalogue output drifts from its contract.

The catalogue and profiles may become outdated as providers change pricing, access, availability, integrations, licensing, and terms. Verify important current claims with original sources and retain evidence dates.

## Deployment and rollback

The root `vercel.json` targets `web/package.json` with Vercel's Next.js builder.

Every deployment must be verified against the relevant route and browser matrix. A READY badge alone is not evidence that the correct application is serving. At minimum, probe `/`, `/collections`, `/resources`, `/saved`, `/about`, and expected not-found behaviour.

The previous repository-root static production deployment remains recorded as the historical rollback target for the Phase 1 cutover. Current release evidence, known-good deployment identifiers, production preconditions, and rollback procedure remain under `docs/slices/9.2-phase-1-release-hardening.md` and `docs/slices/9.3-production-replacement.md`.

The new product direction does not rewrite or erase the verified Phase 1 deployment history. Future route replacement must define its own rollout and rollback evidence.

## Delivery rules

Every implementation slice follows:

1. current `main`;
2. `docs/product-realignment-v3.md`;
3. `docs/product-direction.md`;
4. `PRD.md`;
5. `build-slices.md`;
6. `AGENTS.md`;
7. `design.md` for visible UI work;
8. relevant contracts, schemas, code, tests, and slice evidence.

One independently reviewable slice is implemented per branch and pull request.
