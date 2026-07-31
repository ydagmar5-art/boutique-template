import "server-only";
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";

/** Hash scrypt salé : `salt:hash` (hex). Jamais de mot de passe en clair. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const original = Buffer.from(hash, "hex");
  return (
    candidate.length === original.length &&
    timingSafeEqual(candidate, original)
  );
}
