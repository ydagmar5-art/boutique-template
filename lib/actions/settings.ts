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
): Promise<{ ok: true }> {
  const store = await read<GatewayStore>(KEY, {});
  const prev = store[id]?.credentials || {};
  // Conserve les secrets déjà enregistrés si le champ est laissé vide.
  const merged: Record<string, string> = { ...prev };
  for (const [k, v] of Object.entries(data.credentials)) {
    if (v) merged[k] = v;
  }
  store[id] = { enabled: data.enabled, mode: data.mode, credentials: merged };
  await write(KEY, store);
  revalidatePath("/admin/payments");
  return { ok: true };
}
