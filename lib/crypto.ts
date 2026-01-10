/**
 * Encryption and token generation utilities for OAuth 2.0
 *
 * Uses AES-256-GCM for encryption (authenticated encryption)
 * Uses SHA-256 for secret hashing (Edge runtime compatible, no bcrypt)
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Get the encryption key from environment variable
 * Must be a 32-byte (64 character) hex string
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is required");
  }
  if (key.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be a 64-character hex string (32 bytes)");
  }
  return Buffer.from(key, "hex");
}

/**
 * Encrypt plaintext using AES-256-GCM
 * Returns format: iv:authTag:ciphertext (all hex encoded)
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Return: iv:authTag:encrypted (all hex)
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt ciphertext encrypted with encrypt()
 * Input format: iv:authTag:ciphertext (all hex encoded)
 */
export function decrypt(encrypted: string): string {
  const parts = encrypted.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted format");
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertextHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Hash a secret using SHA-256 with a random salt
 * Edge runtime compatible (no bcrypt)
 * Returns format: salt:hash (both hex encoded)
 */
export function hashSecret(secret: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.createHash("sha256").update(salt + secret).digest("hex");
  return `${salt}:${hash}`;
}

/**
 * Verify a secret against a hash created by hashSecret()
 * Input format: salt:hash (both hex encoded)
 */
export function verifySecret(secret: string, storedHash: string): boolean {
  const parts = storedHash.split(":");
  if (parts.length !== 2) {
    return false;
  }

  const [salt, hash] = parts;
  const computedHash = crypto.createHash("sha256").update(salt + secret).digest("hex");

  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(computedHash, "hex"));
}

/**
 * Generate a client ID (UUID v4 format)
 */
export function generateClientId(): string {
  return crypto.randomUUID();
}

/**
 * Generate a client secret (32 bytes, base64url encoded)
 */
export function generateClientSecret(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Generate an authorization code (32 bytes, base64url encoded)
 */
export function generateAuthorizationCode(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Generate a refresh token (32 bytes, base64url encoded)
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}
