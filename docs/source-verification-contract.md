# Tessli Source Verification Contract

Status: **Product Plan v2 / Slice 1.5**  
Contract: `tessli.resource-verification.v1`

## 1. Purpose

A Tessli intelligence profile is repository research. A public **Verified** source requires a separate completed human-operator record proving that the reviewed profile, evidence, interfaces, governance boundaries, and freshness were checked together.

A verification record does not:

- copy provider content;
- prove permanent provider availability;
- grant a licence;
- store credentials;
- mutate a SourceProfile;
- promote coverage by existing alone.

Slice 1.5 defines the record and workflow. Slice 1.6 may promote a bounded set only after completed eligible records exist.

## 2. Record identity

Each record binds:

- canonical catalogue `resourceId`;
- canonical `resourceSlug`;
- the intelligence profile review date;
- a SHA-256 fingerprint of the exact canonical intelligence profile;
- one human-operator reviewer;
- explicit start and completion dates.

Any profile edit invalidates the fingerprint. The operator must create or reconcile a new record rather than silently accepting stale evidence.

## 3. Required review areas

### 3.1 Provider availability

The operator records the observed canonical URL, date, method, result, and bounded notes.

A passed check means only that the operator observed the expected destination at that time. It is not an uptime guarantee.

### 3.2 Claim-level evidence

Every canonical profile evidence claim is copied into the draft in stable order. The operator marks each claim:

- `confirmed`;
- `contradicted`;
- `uncertain`.

Completed records cannot retain `pending` checks. A `verified` decision requires every claim to be confirmed.

### 3.3 Agent interfaces

Every documented MCP, API, CLI, SDK, or plugin interface is copied into the draft. The record stores only credential-handling classification such as `user-owned-not-recorded`; it never stores tokens, passwords, cookies, API keys, or session values.

A `verified` decision requires each recorded interface to pass through the matching manual method. HTTP APIs and remote MCP transports require `manual-api-test`; CLIs, SDKs, stdio MCP, and local-process MCP require `manual-cli-test`; in-product plugins require `manual-browser`. Documentation review alone cannot pass an interface. Sources without documented agent interfaces have an empty interface list.

### 3.4 Governance

The operator reviews:

- persistence;
- redistribution;
- attribution;
- current terms or licence documentation.

A verified record requires all four to be confirmed. Canonical provider availability must also be observed through `manual-browser`; documentation review alone is insufficient. Asset-specific licences still prevail over a source-level summary.

### 3.5 Limitations and freshness

The operator confirms that the profile limitations were reviewed and records:

- freshness status;
- a future or same-day recheck deadline.

A verified decision requires `current` freshness and a recheck date not earlier than completion or Tessli's deterministic current source-profile review date. Once that bounded recheck date is stale, the record is no longer promotion-eligible and public coverage falls back to Profiled until review is renewed.

## 4. Decisions

### Draft

- `status: draft`;
- `completedAt: null`;
- `decision: pending`;
- checks may remain pending.

### Completed — needs review

Use when evidence is incomplete, uncertain, unavailable, or awaiting another operator. Completed fields and dates are required, but the record is not promotion-eligible.

### Completed — rejected

Use when a material claim, interface, governance boundary, or identity is contradicted. The profile should be corrected in a separate slice before another verification attempt.

### Completed — verified

Promotion eligibility requires all of the following:

- current source identity and profile fingerprint;
- explicit human-operator reviewer;
- completed dates in order;
- passed availability;
- all claims confirmed;
- all recorded interfaces passed;
- persistence, redistribution, attribution, and terms confirmed;
- limitations reviewed;
- current freshness and valid recheck date;
- non-empty decision notes.

Eligibility is read-only. Slice 1.6 must explicitly review and consume the record before changing coverage.

## 5. Local operator workflow

Run commands from `web/`.

### Create a deterministic draft

```bash
npm run verification:draft -- \
  <source-id-or-slug> \
  --reviewer <operator-id> \
  --date YYYY-MM-DD \
  --output ../verification-work/<slug>.json
```

Optional reviewer display name:

```bash
--name "Reviewer display name"
```

The draft command:

- reads repository data only;
- performs no network request;
- refuses unknown or Listed-only sources;
- copies canonical claims and documented interfaces;
- writes stable two-space JSON with LF and one final newline;
- refuses to overwrite an existing file.

### Perform manual checks

The operator uses current official pages, documentation, repositories, legal pages, or explicit manual interface tests. User-owned credentials may be used only in the provider's normal interface and must never be pasted into the record or repository.

Fill results, dates, notes, decision, and recheck date manually.

### Validate a record

```bash
npm run verification:check -- ../verification-work/<slug>.json
```

Validation checks:

- JSON Schema;
- canonical source identity;
- current profile fingerprint and review date;
- exact claim and interface sets;
- reviewer identity;
- date ordering;
- completed-field requirements;
- Verified decision gates.

The command exits non-zero with actionable errors when validation fails. It never edits the record or source profile.

## 6. Storage and privacy

Drafts may remain outside the repository while work is incomplete. A future completed record intended for promotion belongs under a reviewed repository path defined by Slice 1.6.

Never store:

- credentials or secrets;
- cookies or session data;
- private provider responses;
- proprietary screenshots or downloaded assets;
- customer or workspace content;
- full paid/private library content.

Record only bounded observations, official source links, classifications, dates, and review notes.

## 7. Safe failure

When a source is unavailable, a claim is contradicted, credentials are unavailable, terms are unclear, or the profile fingerprint is stale:

1. do not promote the source;
2. record `needs-review` or `rejected` where the review is complete;
3. preserve the evidence boundary;
4. correct the profile in a separate reviewable slice when required;
5. create or reconcile a new verification record after the profile changes.
