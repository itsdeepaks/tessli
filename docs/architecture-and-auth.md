# Tessli Architecture and Authentication Plan

Status: **active architecture direction under V3.0 reconciliation**
Authoritative product direction: `docs/product-realignment-v3.md`

## 1. Architecture principle

Tessli uses one canonical structured truth across:

- the public website;
- generated JSON;
- Markdown research packs;
- the existing native MCP;
- future API surfaces;
- future project/evaluation tooling.

Do not create parallel website and MCP taxonomies.

## 2. Current stack

- Next.js App Router
- TypeScript
- Tailwind CSS with Tessli CSS-variable tokens
- selectively restyled platform/Radix/shadcn primitives
- repository-managed public source catalogue
- repository-managed intelligence profiles and evidence
- local browser storage for initial Saved and Boards
- Supabase Auth/Postgres for later cloud persistence
- Row Level Security for all future user-owned cloud data
- Resend/custom SMTP for production auth and transactional email
- Vercel for preview and production deployment

Do not import a prebuilt visual theme.

## 3. Canonical data layers

### 3.1 Source catalogue

The 295-source catalogue preserves stable IDs, slugs, URLs, categories, access, and descriptions.

Normal build/test remains deterministic and network-free.

### 3.2 Intelligence profiles

Profiles enrich catalogue sources with:

- capabilities;
- content objects;
- platforms/frameworks;
- discovery methods;
- workflow fit;
- planned access routes;
- limitations;
- governance;
- evidence;
- verification dates.

Profile fields are optional unless required by the coverage level. Missing data must not be invented.

V3.2 introduces the `AccessRoute` vocabulary for browser, documentation, package-registry, source-code, API, MCP, CLI, and plugin access. It replaces overlapping future integration/agent-interface terminology, but does not change the current schema or claim populated routes before that slice.

### 3.3 Coverage levels

- Listed
- Profiled
- Verified

Coverage level must be deterministically derived or explicitly reviewed and exposed consistently to website and MCP consumers.

### 3.4 Project research

Initial project data remains browser-local:

- Boards;
- items;
- notes;
- selected/rejected state;
- constraints;
- unresolved questions;
- export settings.

Cloud persistence is deferred until this local workflow proves value.

### 3.5 Pattern/evaluation data

Pattern Candidates and evaluation records remain separate from source catalogue truth.

A generated observation does not become a curated pattern or approved precedent without human review.

## 4. Public rendering architecture

### Canonical Browse

`/resources` becomes the only catalogue browser.

Requirements:

- URL-backed query, filters, sort, view, and page;
- pagination;
- no default render of all 295 sources;
- no duplicate complete mobile/desktop result trees;
- card/list/table views backed by the same state and data;
- source profile as primary navigation;
- separate external Visit source action.

### Source Detail

`/resources/[slug]` is generated for every stable source slug.

Listed pages render minimum truthful metadata. Profiled and Verified pages progressively expose richer sections.

### Machine-readable output and discovery

Current public source and Collection representations are static, deterministic, and derive from canonical source/profile truth. V3.9 may introduce compact action-oriented revisions only after V3.7 retrieval is stable. V3.10 may make supported public interfaces discoverable through `robots.txt`, `llms.txt`, sitemap, and For AI links; it must not create a bulk catalogue endpoint or expose Saved or Board data.

Approved outputs include or may include:

```text
/resources/[slug].json
/resources/[slug].md
/collections/[slug].json
/collections/[slug].md
/boards/[id]/export.md
```

These outputs must share source/profile truth and must not expose private local/cloud Board data without explicit user action and authorization.

## 5. Search architecture

Browse search remains deterministic over the repository catalogue/profile index.

Search should support task intent through structured fields, not only raw substring matching.

Potential fields:

- name/domain/summary;
- category/source type;
- best-for/workflow fit;
- capabilities/content objects;
- platforms/frameworks;
- planned access routes;
- limitations/access.

A vector/semantic index may be evaluated later, but it does not replace curated metadata, evidence, access constraints, or deterministic fallback search. V3.7 is a separate deterministic task-retrieval contract: structured task input yields at most eight explained source choices, including fit reasons, caveats, alternatives, and available access routes. It does not add embeddings, LLM ranking, or a public endpoint.

## 6. MCP architecture

The current native MCP remains a local, read-only, repository-backed stdio server.

Requirements:

- same profile truth as the website;
- bounded result counts;
- deterministic output where possible;
- compact task-fit output with optional diagnostic provenance, freshness, and verification state;
- evidence-linked claims;
- explicit limitations/governance;
- no live website verification, provider browsing, or provider proxying;
- no provider credentials stored by Tessli;
- no proxying or persistence of paid/private content.

V3.8 follows V3.7 and exposes five focused capabilities: `find_sources`, `get_source`, `find_alternatives`, `get_collection`, and `create_research_brief`. The v1 tool list is not registered as MCP aliases because every registered stdio tool is necessarily public through `ListTools`; direct library adapters remain only where an existing internal parity check needs them. `verify_resource` is not part of the normal MCP workflow.

Remote Streamable HTTP MCP is deferred to V3.16, after local task retrieval and compact public outputs stabilise. It must use the same pure tool layer and public data only, with read-only allowlists, bounded input, origin validation, rate limits, safe logs, timeouts, and monitoring. It must not read browser-local Boards, write Tessli state, fetch providers, proxy paid/private content, or accept provider credentials.

## 7. Local Boards architecture

Initial Boards use a versioned browser-local schema.

Minimum entities:

```text
Board
Board item
Item note
Project constraints
Selected/rejected state
Open question
Export metadata
```

Requirements:

- deterministic IDs;
- migration/version strategy;
- corrupted-state fallback;
- cross-tab synchronisation where practical;
- no silent deletion;
- clear local-only copy;
- deterministic Markdown export;
- compact JSON agent handoff only after V3.13;
- no auth dependency.

## 8. Authentication timing

Authentication does not block Browse, Source Detail, Saved, local Boards, or research-pack export.

Public Sign in remains withheld until:

- one complete authentication flow works;
- cloud Saved/Boards provide a real benefit;
- local-to-cloud merge is defined;
- production SMTP works;
- RLS and session boundaries pass review;
- recovery, export, and deletion are defined.

The existing disabled auth shell is implementation groundwork, not a public feature.

## 9. Authentication methods

Supabase Auth may support:

- Google OAuth;
- email/password;
- signup email verification OTP;
- password recovery;
- optional passwordless email OTP only if deliberately offered;
- authenticator-app TOTP MFA later.

Do not combine every method into one unclear flow.

## 10. Signup flow

### Google

```text
Continue with Google
→ OAuth callback
→ create/resolve profile
→ prompt only for missing profile data if needed
→ optional local-data merge
```

Google-authenticated users do not receive an additional Tessli signup OTP merely to repeat identity verification.

### Email/password

```text
First name
Last name
Email
Password
Terms and Privacy acceptance
→ create pending account
→ send six-digit verification OTP
→ verify email
→ create/resolve profile
→ optional local-data merge
```

Requirements:

- accessible password visibility control;
- password requirements shown clearly;
- generic duplicate-account/error responses where security requires;
- rate limiting and abuse controls;
- verification expiry and resend handling;
- no account workspace access before required verification succeeds.

## 11. Standard sign-in flow

```text
Continue with Google
or
Email + password
→ authenticated session
```

Do not require emailed OTP after every normal password sign-in.

An additional factor is requested only when:

- the user enabled MFA;
- a sensitive action requires reauthentication;
- a future approved risk system requires it.

Optional MFA should use authenticator TOTP rather than treating email OTP as strong second-factor security.

## 12. Verification page

Signup verification requires:

- masked email;
- accessible single input presented as six visual slots if desired;
- paste support;
- automatic submission on complete code;
- resend countdown;
- change-email path;
- wrong/expired-code state;
- rate-limit state;
- delivery-delay guidance;
- offline/network error handling;
- focus and screen-reader support.

## 13. Sign-in page composition

Recommended hierarchy:

1. Tessli identity;
2. concise value statement;
3. Continue with Google;
4. divider: or continue with email;
5. email;
6. password with visibility control;
7. Forgot password;
8. Sign in;
9. Create account link;
10. Terms/Privacy microcopy.

Do not show separate Password and Six-digit-code method buttons when the form already communicates the method.

Do not show Remember me unless it genuinely changes session persistence.

## 14. Password recovery

```text
Enter email
→ generic confirmation
→ recovery email/link or approved code flow
→ set new password
→ revoke/rotate sessions where appropriate
→ security confirmation
```

Do not reveal whether an account exists through detailed public errors.

## 15. User profile

The future profile may contain:

- first name;
- last name;
- display/avatar information;
- role/product interests where genuinely useful;
- timestamps.

Store user-owned profile data in an RLS-protected table. Provider metadata may seed missing fields but is not the sole durable profile model.

## 16. Local-to-cloud migration

After first successful sign-in with cloud Boards approved:

1. detect browser-local Saved/Boards;
2. display exact counts;
3. ask whether to merge;
4. upsert without duplicates;
5. retain local data until confirmed;
6. never overwrite cloud data silently;
7. provide a clear local cleanup choice;
8. make migration idempotent.

## 17. Authorization and RLS

All future user-owned tables enable RLS.

Examples:

- users manage only their own Saved records;
- users manage only their own Boards/items/notes/constraints;
- private research packs are not publicly readable;
- users see only their own submissions/reports unless published;
- moderation requires explicit server-side authorization;
- service-role keys never appear in browser code, logs, screenshots, fixtures, or GitHub.

RLS must be tested as anonymous, authenticated owner, authenticated non-owner, and privileged server where applicable.

## 18. Session and security requirements

- cookie-aware Supabase SSR clients;
- PKCE/OAuth callback validation;
- safe redirect allowlist;
- CSRF/session review for sensitive mutations;
- secure cookie configuration;
- generic auth errors;
- rate limits;
- custom SMTP;
- account email/password-change notifications;
- active-session management where supported;
- sign out current/all sessions;
- account export and deletion;
- no public launch with disabled or partially wired controls.

## 19. Production email

Supabase default SMTP is not suitable for public production use.

Connect Resend/custom SMTP before public auth email testing.

Required templates when auth resumes:

- signup confirmation/verification;
- password recovery;
- email change;
- security notification;
- optional passwordless OTP only if approved.

Application transactional email remains separate from auth email where appropriate.

## 20. Forms and abuse protection

Future Submit/Report workflows require:

- server-side validation;
- URL normalization;
- duplicate detection;
- length limits;
- rate limits;
- honeypot;
- Turnstile/CAPTCHA only when justified;
- contextual source IDs;
- safe errors;
- evidence/provenance fields;
- moderation status and ownership;
- audit timestamps.

Do not expose placeholder forms as working product actions.

## 21. External-source and media security

- validate protocols and hosts;
- block private/local networks;
- bound redirects, response size, and time;
- allow only reviewed MIME/content types;
- do not inject remote HTML/SVG;
- do not bypass login, consent, paywall, CAPTCHA, or anti-bot controls;
- do not persist/redistribute proprietary screenshots without permission;
- keep fetch/capture as explicit operator workflows, not normal build/runtime behaviour.

Approved repository-managed previews and the existing fallback chain are the default human preview mode. A live iframe is not an agent interface and remains deferred to V3.15: it requires separate approval, a small allowlist, sandbox/security/performance/mobile checks, and a complete static fallback.

## 22. Deployment environments

- local;
- preview per pull request;
- production.

Future real-user auth/cloud rollout requires deliberate Supabase environment separation or an approved safe equivalent.

OAuth redirects must account for local, preview strategy, and production.

## 23. Deferred architecture decisions

- cloud Board collaboration;
- public/shareable Boards;
- public profiles;
- semantic/vector search infrastructure;
- private source ingestion;
- pattern/evaluation database placement;
- screenshot service;
- object-storage image cache beyond approved media workflows;
- team workspaces;
- payments;
- analytics/consent;
- recommendation learning/ranking.
- hosted remote MCP before V3.16.
