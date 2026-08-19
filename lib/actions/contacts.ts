"use server";

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  CARNET D'ADRESSES                                               ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Réunit en une seule liste les deux populations que la boutique collecte :
 * les clientes (issues des commandes) et les inscrites à la lettre. Une même
 * adresse peut être dans les deux — elle n'apparaît alors qu'une fois, avec
 * le statut le plus fort.
 *
 * Sert à exporter un fichier exploitable par un outil d'e-mailing.
 *
 * ⚠️ RGPD — ces adresses ont été collectées pour honorer une commande ou
 * pour envoyer la lettre de la maison. Les exporter vers un outil de
 * campagne est un usage compatible pour les inscrites ; pour les clientes
 * qui n'ont PAS coché la lettre, la prospection par e-mail n'est licite que
 * sur des produits analogues (art. L34-5 CPCE), et chaque envoi doit porter
 * un lien de désinscription. C'est le colonne `statut` qui permet de faire
 * la différence — ne pas l'ignorer à l'import.
 *
 * ⚠️ Fichier `"use server"` : uniquement des fonctions async exportées.
 */

import { read } from "@/lib/db/store";
import type { Customer, Order } from "@/lib/db/seed";
import type { Contact } from "@/lib/contacts-types";

interface Subscriber {
  email: string;
  date: string;
}

export async function listContacts(): Promise<Contact[]> {
  const [customers, subscribers, orders] = await Promise.all([
    read<Customer[]>("customers", []),
    read<Subscriber[]>("newsletter", []),
    read<Order[]>("orders", []),
  ]);

  /** Clé de regroupement : l'e-mail normalisé, jamais le nom. */
  const clef = (e: string) => e.trim().toLowerCase();

  // Dernière commande par adresse, pour dater la relation commerciale.
  // On en profite pour relever le téléphone : c'est le plus récent qui vaut,
  // une cliente qui déménage ou change de numéro le corrige en commandant.
  const derniere = new Map<string, string>();
  const telephone = new Map<string, string>();
  for (const o of orders) {
    if (!o.email) continue;
    const k = clef(o.email);
    const actuelle = derniere.get(k);
    if (!actuelle || o.date > actuelle) {
      derniere.set(k, o.date);
      if (o.phone) telephone.set(k, o.phone);
    }
  }

  const par = new Map<string, Contact>();

  for (const c of customers) {
    if (!c.email) continue;
    const k = clef(c.email);
    par.set(k, {
      email: k,
      nom: c.name ?? "",
      statut: "cliente",
      commandes: c.orders ?? 0,
      depense: c.spent ?? 0,
      derniereCommande: derniere.get(k),
      telephone: telephone.get(k),
    });
  }

  for (const s of subscribers) {
    if (!s.email) continue;
    const k = clef(s.email);
    const existante = par.get(k);
    if (existante) {
      existante.statut = "cliente-inscrite";
      existante.inscriteLe = s.date;
    } else {
      par.set(k, {
        email: k,
        nom: "",
        statut: "inscrite",
        commandes: 0,
        depense: 0,
        inscriteLe: s.date,
      });
    }
  }

  // Les meilleures clientes d'abord, puis les inscrites les plus récentes.
  return [...par.values()].sort(
    (a, b) =>
      b.depense - a.depense ||
      (b.inscriteLe ?? "").localeCompare(a.inscriteLe ?? ""),
  );
}
