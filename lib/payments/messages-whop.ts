/**
 * Messages d'échec Whop → français, pour la cliente.
 *
 * Whop renvoie des messages anglais techniques (« [card_number_validation_failed]
 * Your card details are incomplete or invalid », « Your card was declined »).
 * Une cliente ne doit voir ni code, ni anglais : on reconnaît les cas courants
 * et on retombe sur un message clair pour le reste.
 */
export const REFUS_GENERIQUE =
  "Paiement refusé par votre banque. Vérifiez vos informations ou essayez une autre carte.";

export function messageWhop(brut: string | null | undefined, repli = REFUS_GENERIQUE): string {
  const m = String(brut ?? "").toLowerCase();
  if (!m) return repli;
  if (/validation|incomplete|invalid_number|incorrect_number|invalid card|card details/.test(m))
    return "Les informations de votre carte sont incomplètes ou invalides. Vérifiez le numéro, la date d'expiration et le code.";
  if (/insufficient/.test(m)) return "Paiement refusé : fonds insuffisants sur cette carte.";
  if (/expired/.test(m)) return "Paiement refusé : cette carte est expirée.";
  if (/cvc|security code/.test(m)) return "Paiement refusé : le code de sécurité (CVC) est incorrect.";
  if (/authentication|3d ?secure|3ds/.test(m))
    return "La validation auprès de votre banque n'a pas abouti. Réessayez et confirmez le paiement dans l'application de votre banque.";
  if (/declined|refus|do_not_honor|generic/.test(m)) return REFUS_GENERIQUE;
  return repli;
}
