import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

type KeySource = "api" | "jwt";

function getEncryptionKey(source?: KeySource) {
  const apiSecret = process.env.API_KEY_ENCRYPTION_SECRET?.trim();
  const jwtSecret = process.env.JWT_SECRET?.trim();
  const selectedSource = source ?? (apiSecret ? "api" : "jwt");
  const secret = selectedSource === "api" ? apiSecret : jwtSecret;
  if (!secret) {
    throw new Error(
      selectedSource === "api"
        ? "API_KEY_ENCRYPTION_SECRET is not configured."
        : "Configure API_KEY_ENCRYPTION_SECRET or JWT_SECRET to encrypt API keys.",
    );
  }
  return {
    source: selectedSource,
    key: createHash("sha256").update(`smm-reseller-api-key:v1:${secret}`).digest(),
  };
}

export function encryptApiKey(secret: string) {
  const { source, key } = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", source, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptApiKey(encryptedSecret: string) {
  const [version, source, encodedIv, encodedTag, encodedCiphertext, ...unexpected] = encryptedSecret.split(".");
  if (
    version !== "v1" ||
    (source !== "api" && source !== "jwt") ||
    !encodedIv ||
    !encodedTag ||
    !encodedCiphertext ||
    unexpected.length > 0
  ) {
    throw new Error("Stored API key encryption data is invalid.");
  }

  const { key } = getEncryptionKey(source);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(encodedIv, "base64url"));
  decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encodedCiphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
