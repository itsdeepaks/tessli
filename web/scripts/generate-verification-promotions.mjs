import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

import { stableJson } from "../lib/resource-verification.ts";
import {
  VERIFICATION_PROMOTION_REQUEST_CONTRACT,
  VERIFICATION_PROMOTION_VERSION,
  buildVerifiedPromotionRegistry,
} from "../lib/verification-promotions.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(__dirname, "..");
const repositoryRoot = path.join(webRoot, "..");
const recordsRoot = path.join(repositoryRoot, "verification-records");
const requestPath = path.join(recordsRoot, "promotions.json");
const schemaPath = path.join(
  repositoryRoot,
  "schemas/resource-verification-record.schema.json",
);
const outputPath = path.join(webRoot, "data/verified-resource-promotions.json");

function validIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function validUri(value) {
  try {
    const parsed = new URL(value);
    return Boolean(parsed.protocol && parsed.hostname);
  } catch {
    return false;
  }
}

function compileRecordSchema() {
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
    formats: { date: validIsoDate, uri: validUri },
  });
  return ajv.compile(schema);
}

function parsePromotionRequest() {
  const raw = fs.readFileSync(requestPath, "utf8");
  const request = JSON.parse(raw);
  const errors = [];

  if (
    !request ||
    typeof request !== "object" ||
    Array.isArray(request) ||
    request.contract !== VERIFICATION_PROMOTION_REQUEST_CONTRACT ||
    request.version !== VERIFICATION_PROMOTION_VERSION ||
    !Array.isArray(request.resourceIds) ||
    request.resourceIds.some((value) => typeof value !== "string")
  ) {
    errors.push(
      `Promotion request must use ${VERIFICATION_PROMOTION_REQUEST_CONTRACT} version ${VERIFICATION_PROMOTION_VERSION} with a string resourceIds array.`,
    );
  }

  return {
    raw,
    request,
    errors,
  };
}

function listJsonFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listJsonFiles(fullPath));
    else if (entry.isFile() && entry.name.endsWith(".json"))
      files.push(fullPath);
  }

  return files.sort((left, right) => left.localeCompare(right, "en"));
}

function loadRecords(validateSchema) {
  const records = [];
  const errors = [];
  const files = listJsonFiles(recordsRoot).filter(
    (filePath) => path.resolve(filePath) !== path.resolve(requestPath),
  );

  for (const filePath of files) {
    const relativePath = path
      .relative(repositoryRoot, filePath)
      .replaceAll("\\", "/");
    let record;
    try {
      record = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (error) {
      errors.push(
        `${relativePath} is not valid JSON: ${error instanceof Error ? error.message : "unknown parse error"}`,
      );
      continue;
    }

    if (!validateSchema(record)) {
      const details = (validateSchema.errors ?? [])
        .map((error) => {
          const location = error.instancePath || error.dataPath || "record";
          return `${location} ${error.message}`;
        })
        .join("; ");
      errors.push(`${relativePath} failed verification schema: ${details}`);
      continue;
    }

    records.push({ path: relativePath, record });
  }

  return { records, errors };
}

function build() {
  const requestResult = parsePromotionRequest();
  const validateSchema = compileRecordSchema();
  const recordsResult = loadRecords(validateSchema);
  const errors = [...requestResult.errors, ...recordsResult.errors];

  if (errors.length > 0) {
    return { valid: false, errors, registry: null };
  }

  const requestSha256 = createHash("sha256")
    .update(requestResult.raw, "utf8")
    .digest("hex");
  const result = buildVerifiedPromotionRegistry({
    request: requestResult.request,
    requestPath: path
      .relative(repositoryRoot, requestPath)
      .replaceAll("\\", "/"),
    requestSha256,
    records: recordsResult.records,
  });

  return result;
}

function fail(errors) {
  for (const error of errors) console.error(` - ${error}`);
  process.exitCode = 1;
}

const mode = process.argv[2] ?? "--generate";
if (mode !== "--generate" && mode !== "--check") {
  console.error(
    "Usage: node scripts/generate-verification-promotions.mjs [--generate|--check]",
  );
  process.exit(1);
}

const result = build();
if (!result.valid || !result.registry) {
  console.error("Verification promotion registry is invalid:");
  fail(result.errors);
} else {
  const bytes = stableJson(result.registry);
  if (mode === "--generate") {
    fs.writeFileSync(outputPath, bytes, "utf8");
    console.log(
      `Generated ${path.relative(repositoryRoot, outputPath)} with ${result.registry.promotions.length} promotion(s).`,
    );
  } else if (!fs.existsSync(outputPath)) {
    fail([
      `${path.relative(repositoryRoot, outputPath)} is missing; run verification:promotions:generate.`,
    ]);
  } else {
    const current = fs.readFileSync(outputPath, "utf8");
    if (current !== bytes) {
      fail([
        `${path.relative(repositoryRoot, outputPath)} has drifted; run verification:promotions:generate.`,
      ]);
    } else {
      console.log(
        `Verification promotions are current: ${result.registry.promotions.length} promotion(s), ${result.registry.recordCount} completed record(s).`,
      );
    }
  }
}
