import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import crypto from "node:crypto";
import ts from "typescript";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "lib/email-auth-core.ts"), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
vm.runInNewContext(output, {
  exports,
  require(name) {
    if (name === "node:crypto") return crypto;
    throw new Error(`Unexpected dependency: ${name}`);
  },
});

test("email identities normalize consistently without storing the address in the owner id", () => {
  assert.equal(exports.normalizeEmail("  Person@Example.COM "), "person@example.com");
  assert.equal(exports.normalizeEmail("not-an-email"), null);
  const owner = exports.emailOwnerId("person@example.com");
  assert.match(owner, /^email:[a-f0-9]{48}$/);
  assert.ok(!owner.includes("person"));
  assert.equal(owner, exports.emailOwnerId("person@example.com"));
});

test("one-time codes and rate keys are scoped and secret-dependent", () => {
  const first = exports.emailCodeHash("person@example.com", "123456", "secret-a");
  assert.notEqual(first, exports.emailCodeHash("person@example.com", "654321", "secret-a"));
  assert.notEqual(first, exports.emailCodeHash("person@example.com", "123456", "secret-b"));
  assert.notEqual(
    exports.emailRateKey("email", "person@example.com", "secret-a"),
    exports.emailRateKey("network", "person@example.com", "secret-a"),
  );
});

test("login redirects remain local and email display is masked", () => {
  assert.equal(exports.safeRedirectPath("/join/token"), "/join/token");
  assert.equal(exports.safeRedirectPath("https://example.com"), "/app");
  assert.equal(exports.safeRedirectPath("//example.com"), "/app");
  assert.equal(exports.maskEmail("person@example.com"), "pe••••@example.com");
});
