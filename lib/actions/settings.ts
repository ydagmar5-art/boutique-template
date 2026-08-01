"use server";

import { revalidatePath } from "next/cache";
import { read, write } from "@/lib/db/store";
import { PAYMENT_PROVIDERS } from "@/lib/payments/providers";

export interface GatewaySaved {
  enabled: boolean;
  mode: "test" | "live";
  /** Champs non-secrets renvoyés au client. */
  values: Record<string, string>;
  /** Clés des champs secrets renseignés (valeur jamais renvoyée). */
  secretsSet: string[];
}

const KEY = "gateways";
type GatewayStore = Record<string, { enabled: boolean; mode: "test" | "live"; credentials: Record<string, string> }>;

/** Renvoie l'état des passerelles SANS exposer les secrets en clair. */
export async function getGateways(): Promise<Record<string, GatewaySaved>> {
  const store = await read<GatewayStore>(KEY, {});
  const out: Record<string, GatewaySaved> = {};
  for (const [id, cfg] of Object.entries(store)) {
    const provider = PAYMENT_PROVIDERS[id];
    if (!provider) continue;
    const secretKeys = new Set(
      [...provider.fields.test, ...provider.fields.live]
        .filter((f) => f.secret)
        .map((f) => f.key),
    );
    const values: Record<string, string> = {};
    const secretsSet: string[] = [];
    for (const [k, v] of Object.entries(cfg.credentials || {})) {
      if (!v) continue;
      if (secretKeys.has(k)) secretsSet.push(k);
      else values[k] = v;
    }
    out[id] = { enabled: cfg.enabled, mode: cfg.mode, values, secretsSet };
  }
  return out;
}

export async function saveGateway(
  id: string,
  data: { enabled: boolean; mode: "test" | "live"; credentials: Record<string, string> },
): Promise<{ ok: boolean; error?: string }> {
  const store = await read<GatewayStore>(KEY, {});
  const prev = store[id]?.credentials || {};
  // Conserve les secrets déjà enregistrés si le champ est laissé vide.
  const merged: Record<string, string> = { ...prev };
  for (const [k, v] of Object.entries(data.credentials)) {
    if (v) merged[k] = v;
  }
  // ── On n'active pas une passerelle qui ne peut pas encaisser ──
  // Depuis qu'une seule passerelle est active à la fois, il n'y a plus de
  // repli : activer un processeur sans ses clés couperait purement et
  // simplement les ventes, sans que personne ne s'en aperçoive.
  if (data.enabled) {
    const missing = (PAYMENT_PROVIDERS[id]?.fields[data.mode] ?? [])
      .filter((f) => !merged[f.key])
      .map((f) => f.label);
    if (missing.length) {
      return {
        ok: false,
        error: `Renseignez d'abord : ${missing.join(", ")}.`,
      };
    }
  }

  store[id] = { enabled: data.enabled, mode: data.mode, credentials: merged };

  // ── Une seule passerelle active à la fois ──
  // La boutique encaisse avec UN processeur ; en activer plusieurs n'apporte
  // rien et crée un piège (c'est le premier de la liste qui l'emporte, pas le
  // dernier activé). Activer une passerelle éteint donc les autres.
  if (data.enabled) {
    for (const other of Object.keys(store)) {
      if (other !== id) store[other] = { ...store[other], enabled: false };
    }
  }

  await write(KEY, store);
  revalidatePath("/admin/payments");
  revalidatePath("/checkout");
  return { ok: true };
}
