import type { PspMode } from "./types";

/**
 * Clés PUBLIQUES transmises au navigateur pour chaque PSP embarqué.
 *
 * Un PSP absent de ce registre est servi en REDIRECTION : c'est le comportement
 * par défaut, donc oublier une entrée dégrade l'expérience mais ne casse et
 * n'expose rien.
 *
 * ⚠️ Ne mettre ici QUE des valeurs destinées au public (clé publishable,
 * identifiant marchand…). Les secrets restent côté serveur : ils signent les
 * requêtes et ne doivent jamais atteindre le navigateur.
 *
 * Renvoyer `null` quand la configuration est incomplète : le checkout bascule
 * alors proprement en redirection plutôt que d'afficher un widget mort.
 */
export type PublicConfig = Record<string, string | boolean>;

type Builder = (
  values: Record<string, string>,
  mode: PspMode,
  /** Clés secrètes déjà enregistrées (leur valeur ne sort jamais du serveur). */
  secretsSet: string[],
) => PublicConfig | null;

export const PSP_PUBLIC_CONFIG: Record<string, Builder> = {
  stripe: (v) => (v.publicKey ? { publishableKey: v.publicKey } : null),

  square: (v, mode) =>
    v.applicationId && v.locationId
      ? {
          applicationId: v.applicationId,
          locationId: v.locationId,
          sandbox: mode !== "live",
        }
      : null,

  fondy: (v) => (v.merchantId ? { merchantId: v.merchantId } : null),

  // Airwallex n'a pas de clé publique : le PaymentIntent est créé côté serveur
  // et c'est lui qui porte le secret de session. On vérifie donc simplement que
  // les identifiants serveur sont là, sinon les champs ne pourraient pas se
  // monter (l'intent partirait en erreur).
  airwallex: (v, mode, secretsSet) =>
    v.clientId && secretsSet.includes("apiKey")
      ? { env: mode === "live" ? "prod" : "demo" }
      : null,
};

/** Config publique d'un PSP, ou null s'il doit passer par une redirection. */
export function publicConfigFor(
  id: string,
  values: Record<string, string> | undefined,
  mode: PspMode,
  secretsSet: string[] = [],
): PublicConfig | null {
  return PSP_PUBLIC_CONFIG[id]?.(values ?? {}, mode, secretsSet) ?? null;
}
