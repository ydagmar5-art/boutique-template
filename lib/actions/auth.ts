"use server";

import { redirect } from "next/navigation";
import { read, write } from "@/lib/db/store";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { setSession, clearSession, getSession } from "@/lib/auth/session";

interface User {
  id: string;
  name: string;
  email: string;
  password: string; // hash
  role: "admin" | "customer";
}

const KEY = "users";

/** Compte admin défini par variables d'environnement (ADMIN_EMAIL / ADMIN_PASSWORD). */
function seedUsers(): User[] {
  return [
    {
      id: "admin",
      name: "Administrateur",
      email: (process.env.ADMIN_EMAIL || "admin@exemple.fr").trim().toLowerCase(),
      password: hashPassword(process.env.ADMIN_PASSWORD || "change-me"),
      role: "admin",
    },
  ];
}

/**
 * ⚠️ L'ADMIN VIENT TOUJOURS DES VARIABLES D'ENVIRONNEMENT. `read` sème la
 * valeur par défaut en base au premier appel : la liste stockée gardait donc
 * l'admin de la PREMIÈRE visite, et changer ADMIN_EMAIL / ADMIN_PASSWORD
 * ensuite n'avait plus aucun effet (« identifiants incorrects » avec les
 * nouveaux, constaté le 05/11/2026). On remplace l'admin stocké par celui
 * des variables à chaque lecture ; les comptes clients restent ceux de la base.
 */
async function users() {
  const seed = seedUsers();
  const enBase = await read<User[]>(KEY, seed);
  return [seed[0], ...enBase.filter((u) => u.id !== "admin")];
}

export type AuthResult = { ok: true } | { ok: false; error: string };

export async function register(formData: FormData): Promise<AuthResult> {
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  if (!name || !email || password.length < 6)
    return { ok: false, error: "Nom, e-mail et mot de passe (6+ caractères) requis." };

  const list = await users();
  if (list.some((u) => u.email === email))
    return { ok: false, error: "Un compte existe déjà avec cet e-mail." };

  const user: User = {
    id: `u-${Date.now()}`,
    name,
    email,
    password: hashPassword(password),
    role: "customer",
  };
  list.unshift(user);
  await write(KEY, list);
  await setSession({ userId: user.id, email, name, role: "customer" });
  return { ok: true };
}

export async function login(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const user = (await users()).find((u) => u.email === email);
  if (!user || !verifyPassword(password, user.password))
    return { ok: false, error: "E-mail ou mot de passe incorrect." };

  await setSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
  return { ok: true };
}

export async function logout(): Promise<void> {
  await clearSession();
  redirect("/");
}

export async function currentUser() {
  return getSession();
}
