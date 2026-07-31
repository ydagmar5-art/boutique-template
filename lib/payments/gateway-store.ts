import "server-only";
import { read } from "@/lib/db/store";

/**
 * Lecture BRUTE de la config d'une passerelle (clés secrètes incluses).
 * server-only : ne DOIT jamais être importé/appelé depuis un composant client.
 */
export interface GatewayRaw {
  enabled: boolean;
  mode: "test" | "live";
  credentials: Record<string, string>;
}

type GatewayStore = Record<string, GatewayRaw>;

export async function getGatewayConfig(id: string): Promise<GatewayRaw | null> {
  const store = await read<GatewayStore>("gateways", {});
  return store[id] ?? null;
}

/** Première passerelle activée, dans l'ordre de brand.payments. */
export async function firstEnabledGateway(
  ids: string[],
): Promise<{ id: string; config: GatewayRaw } | null> {
  const store = await read<GatewayStore>("gateways", {});
  for (const id of ids) {
    const cfg = store[id];
    if (cfg?.enabled) return { id, config: cfg };
  }
  return null;
}
