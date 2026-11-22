import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, test } from "node:test";
import { decryptApiKey, encryptApiKey } from "./api-key-crypto";

const originalApiSecret = process.env.API_KEY_ENCRYPTION_SECRET;
const originalJwtSecret = process.env.JWT_SECRET;

after(() => {
  if (originalApiSecret === undefined) delete process.env.API_KEY_ENCRYPTION_SECRET;
  else process.env.API_KEY_ENCRYPTION_SECRET = originalApiSecret;
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtSecret;
});

test("API encryption secret round-trips and does not depend on JWT secret rotation", () => {
  process.env.API_KEY_ENCRYPTION_SECRET = "test-api-encryption-secret";
  process.env.JWT_SECRET = "jwt-secret-before-rotation";
  const secret = "smm_live_test_api_key";
  const encrypted = encryptApiKey(secret);
  process.env.JWT_SECRET = "jwt-secret-after-rotation";

  assert.equal(decryptApiKey(encrypted), secret);
});

test("JWT secret fallback remains readable when a dedicated encryption secret is added later", () => {
  delete process.env.API_KEY_ENCRYPTION_SECRET;
  process.env.JWT_SECRET = "test-jwt-secret";
  const secret = "smm_live_legacy_encrypted_key";
  const encrypted = encryptApiKey(secret);
  process.env.API_KEY_ENCRYPTION_SECRET = "new-dedicated-secret";

  assert.equal(decryptApiKey(encrypted), secret);
});

test("tampered ciphertext and missing encryption configuration fail explicitly", () => {
  process.env.API_KEY_ENCRYPTION_SECRET = "test-api-encryption-secret";
  const parts = encryptApiKey("smm_live_test_api_key").split(".");
  parts[3] = randomBytes(16).toString("base64url");
  assert.throws(() => decryptApiKey(parts.join(".")));

  delete process.env.API_KEY_ENCRYPTION_SECRET;
  delete process.env.JWT_SECRET;
  assert.throws(() => encryptApiKey("smm_live_test_api_key"), /Configure API_KEY_ENCRYPTION_SECRET or JWT_SECRET/);
});
