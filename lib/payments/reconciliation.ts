import "server-only";

import { createOrder } from "@/lib/actions/orders";
import { createOrderOnce } from "@/lib/payments/finalize";
import { getGatewayConfig } from "@/lib/payments/gateway-store";
import { listByPrefix, read, write } from "@/lib/db/store";
import type { CheckoutDraft } from "@/lib/actions/checkout";
import type { Order } from "@/lib/db/seed";

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  RATTRAPAGE : PAYÉ CHEZ WHOP, ABSENT DE LA BOUTIQUE              ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Troisième et dernier filet. Les deux premiers dépendent d'un messager :
 *   1. le navigateur de la cliente prévient le site — il s'est tu deux fois ;
 *   2. Whop appelle notre webhook — il peut échouer, ou être rejeté.
 *
 * Celui-ci ne dépend de personne : il demande à Whop la liste de ses derniers
 * encaissements et crée les commandes manquantes. Une vente encaissée finit
 * donc TOUJOURS par exister, avec sa confirmation à la cliente, son e-mail au
 * gérant.
 *
 * ⚠️ Déclenché par le trafic du site (page de paiement, back-office), pas par
 * une tâche planifiée : une boutique qui reçoit des visites se répare
 * toute seule, sans dépendre d'un ordonnanceur externe.
 *
 * ⚠️ Silencieux par construction : aucune exception ne remonte. Ce code
 * s'exécute pendant le rendu de pages publiques.
 */

const ORDERS = "orders";
const CLE_DERNIER_PASSAGE = "whop_reconciliation_at";
/** Une vérification au plus toutes les 5 minutes, quel que soit le trafic. */
const REPOS_MS = 5 * 60 * 1000;
/** On ne remonte pas plus loin que 24 h : au-delà, c'est un cas à traiter à la main. */
const FENETRE_MS = 24 * 60 * 60 * 1000;

interface PaiementWhop {
  id: string;
  status?: string;
  substatus?: string;
  created_at?: string;
  user?: { email?: string };
  final_amount?: number;
  subtotal?: number;
  currency?: string;
}

type Brouillon = { done?: boolean; at?: string; orderId?: string | null; draft?: CheckoutDraft };

/** Lance le rattrapage si le délai de repos est écoulé. Ne lève jamais. */
export async function reconcilierWhopSiNecessaire(): Promise<void> {
  try {
    const dernier = await read<{ at?: string }>(CLE_DERNIER_PASSAGE, {});
    const ecoule = Date.now() - Date.parse(dernier?.at ?? "1970-01-01");
    if (ecoule < REPOS_MS) return;
    await write(CLE_DERNIER_PASSAGE, { at: new Date().toISOString() });
    await reconcilierWhop();
  } catch {
    /* le rattrapage ne doit jamais empêcher une page de s'afficher */
  }
}

/** Compare les encaissements Whop aux commandes, et crée ce qui manque. */
export async function reconcilierWhop(): Promise<{ creees: string[] }> {
  const creees: string[] = [];
  const cfg = await getGatewayConfig("whop");
  const cle = cfg?.credentials?.apiKey;
  if (!cfg?.enabled || !cle) return { creees };

  /* Compte `biz_…` : mis en cache par `demarrerWhop` au premier paiement. */
  const societe = (await read<{ id?: string }>("whop_company_id", {}))?.id;
  if (!societe) return { creees };
  const res = await fetch(
    `https://api.whop.com/api/v1/payments?company_id=${encodeURIComponent(societe)}&per=20`,
    { headers: { Authorization: `Bearer ${cle}` }, cache: "no-store" },
  );
  if (!res.ok) {
    console.warn("[rattrapage whop] liste des paiements refusée :", res.status);
    return { creees };
  }
  const data = (await res.json()) as { data?: PaiementWhop[] };
  const paiements = (data.data ?? []).filter(
    (p) =>
      p.status === "paid" &&
      Date.now() - Date.parse(p.created_at ?? "") < FENETRE_MS,
  );
  if (!paiements.length) return { creees };

  const commandes = await read<Order[]>(ORDERS, []);
  const brouillons = await listByPrefix<Brouillon>("pending_whop_");

  for (const p of paiements) {
    const email = (p.user?.email ?? "").trim().toLowerCase();
    const montant = Math.round(((p.final_amount ?? p.subtotal ?? 0) as number) * 100);
    if (!email || !montant) continue;

    /* Déjà enregistrée ? On compare la référence PSP, puis l'e-mail + montant. */
    /* ⚠️ E-mail + montant seulement sur les commandes RÉCENTES : une cliente
       qui rachète le même sac un mois plus tard ne doit pas être ignorée. */
    const deja = commandes.some(
      (o) =>
        o.pspRef === p.id ||
        ((o.email ?? "").trim().toLowerCase() === email &&
          o.total === montant &&
          Date.now() - Date.parse(o.date ?? "") < 2 * FENETRE_MS),
    );
    if (deja) continue;

    const brouillon = brouillons
      .filter((b) => (b.value?.draft?.email ?? "").trim().toLowerCase() === email)
      .filter((b) => Math.abs((b.value?.draft?.total ?? -1) - montant) <= 1)
      .sort((x, y) => (y.value?.at ?? "").localeCompare(x.value?.at ?? ""))[0];

    const draft = brouillon?.value?.draft;
    if (!draft) {
      console.warn("[rattrapage whop] paiement sans brouillon :", p.id, email, montant);
      continue;
    }

    try {
      const { orderId } = await createOrderOnce(
        `whop_${p.id}`,
        `whop_done_${p.id}`,
        async () => {
          const { id } = await createOrder({
            customer: draft.customer,
            email: draft.email,
            address: draft.address,
            items: draft.items,
            total: draft.total,
            subtotal: draft.subtotal,
            discounts: draft.discounts,
            psp: "Whop",
            phone: draft.phone,
            pspRef: p.id,
            source: draft.source,
          });
          return id;
        },
      );
      if (orderId && orderId !== "deja") {
        await write(`whop_done_${p.id}`, { done: true, orderId });
        await write(brouillon.key, { ...brouillon.value, done: true, orderId });
        creees.push(orderId);
        console.info("[rattrapage whop] commande créée :", orderId, p.id);
      }
    } catch (e) {
      console.error("[rattrapage whop] création impossible :", p.id, e);
    }
  }
  return { creees };
}
