import type { PaymentProviderId } from "@/config/brand.config";

/**
 * Champs de clés API saisis dans le back-office (hub de paiement).
 * `secret: true` => masqué dans l'UI et jamais renvoyé en clair côté client.
 */
export interface PspCredentialField {
  key: string;
  label: string;
  secret?: boolean;
  placeholder?: string;
  /** Indice de format pour guider la saisie (ex: "pk_live_..."). */
  hint?: string;
}

/**
 * Métadonnées d'un PSP. La logique d'encaissement réelle passe TOUJOURS par le
 * SDK/élément hébergé officiel du PSP — aucune donnée carte ne touche nos serveurs.
 */
export interface PaymentProvider {
  id: PaymentProviderId;
  name: string;
  /** Mode d'intégration conforme PCI. */
  integration: "hosted-elements" | "redirect" | "hosted-checkout";
  /** Niveau PCI cible une fois intégré correctement. */
  pciScope: "SAQ-A" | "SAQ-A-EP";
  description: string;
  docsUrl: string;
  /** true si le PSP signe ses webhooks (à vérifier côté serveur). */
  webhookSigned: boolean;
  /** true si l'encaissement réel est intégré (checkout fonctionnel). */
  functional?: boolean;
  /** Champs de configuration (test + live). */
  fields: { test: PspCredentialField[]; live: PspCredentialField[] };
}

export type PspMode = "test" | "live";

/** Statut d'une passerelle dans le back-office. */
export interface PspConfigState {
  enabled: boolean;
  mode: PspMode;
  /** Valeurs saisies — en prod, chiffrées au repos, jamais en localStorage clair. */
  credentials: Record<string, string>;
}
