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

  /*
    Whop n'expose AUCUNE clé publique : la session de paiement est créée côté
    serveur et c'est elle qui porte le montant. On vérifie seulement que la
    clé serveur est enregistrée, sinon les champs ne pourraient pas se monter.
  */
  whop: (v, mode, secretsSet) => (secretsSet.includes("apiKey") ? {} : null),

  // Airwallex n'a pas de clé publique : le PaymentIntent est créé côté serveur
  // et c'est lui qui porte le secret de session. On vérifie donc simplement que
  // les identifiants serveur sont là, sinon les champs ne pourraient pas se
  // monter (l'intent partirait en erreur).
  // Mollie : le navigateur n'a besoin que du profileId (public par nature) et
  // du mode. Le `testmode` se DÉDUIT du préfixe de la clé API, pas de l'onglet
  // choisi dans le back-office : une clé `test_` rangée en « live » monterait
  // sinon des champs en mode production et ferait échouer la tokenisation.
  mollie: (v, mode, secretsSet) =>
    v.profileId && secretsSet.includes("apiKey")
      ? { profileId: v.profileId, testmode: mode !== "live" }
      : null,

  airwallex: (v, mode, secretsSet) =>
    v.clientId && secretsSet.includes("apiKey")
      ? { env: mode === "live" ? "prod" : "demo" }
      : null,

  /**
   * Viva : rien de secret ici non plus. Le jeton OAuth dont le SDK a besoin
   * n'est PAS transmis à ce stade — il est délivré au moment de créer l'ordre,
   * juste avant le paiement, pour que sa durée de vie couvre la saisie de la
   * carte et rien de plus.
   */
  viva: (v, mode, secretsSet) =>
    v.merchantId &&
    v.sourceCode &&
    secretsSet.includes("apiKey") &&
    secretsSet.includes("clientSecret")
      ? { demo: mode !== "live" }
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
