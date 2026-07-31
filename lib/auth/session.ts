import "server-only";
import { cookies } from "next/headers";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { store } from "@/config/store.config";

const COOKIE = store.cookies.session;

/**
 * Clé de signature du cookie de session admin.
 *
 * ⚠️ SÉCURITÉ — le repli de développement est une valeur PUBLIQUE, présente en
 * clair dans ce dépôt. Sans `AUTH_SECRET` en production, n'importe qui ayant lu
 * ce fichier peut forger un cookie et entrer dans le back-office. On refuse
 * donc de démarrer plutôt que de laisser l'admin ouvert en silence.
 */
function sessionSecret(): string {
  const fromEnv = process.env.AUTH_SECRET;
  if (fromEnv) return fromEnv;

  if (process.env.NODE_ENV === "production") {
    // On NE lève PAS d'exception : ça ferait échouer le build, y compris sur un
    // clone tout neuf. On tire une clé aléatoire à chaque démarrage — personne
    // ne peut forger de cookie, mais les sessions admin sont invalidées à
    // chaque déploiement (reconnexion nécessaire). C'est le symptôme qui doit
    // alerter : la vraie correction est de renseigner AUTH_SECRET.
    console.error(
      "[sécurité] AUTH_SECRET manquant : clé de session aléatoire, les " +
        "administrateurs seront déconnectés à chaque déploiement. " +
        "Générez-la avec `openssl rand -base64 32`.",
    );
    return randomBytes(32).toString("base64");
  }
  return "dev-secret-non-securise-ne-jamais-utiliser-en-prod";
}

const SECRET = sessionSecret();

export interface Session {
  userId: string;
  email: string;
  name: string;
  role: "admin" | "customer";
}

function sign(value: string): string {
  return createHmac("sha256", SECRET).update(value).digest("hex");
}

function encode(session: Session): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decode(token: string): Session | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  return token ? decode(token) : null;
}

export async function setSession(session: Session): Promise<void> {
  (await cookies()).set(COOKIE, encode(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
