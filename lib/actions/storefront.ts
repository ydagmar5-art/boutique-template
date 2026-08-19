"use server";

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  RÉGLAGES DE VITRINE                                             ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Ce que le gérant pilote depuis le tableau de bord sans toucher au code.
 * Aujourd'hui : le modèle mis en avant dans le hero de l'accueil — c'est le
 * levier d'A/B testing le plus rentable de la page, et il devait être
 * changeable en deux clics.
 *
 * ⚠️ `read()` ne re-seede QUE si la clé est absente en base : modifier la
 * valeur par défaut ci-dessous n'a plus d'effet une fois la clé écrite.
 *
 * ⚠️ Ce fichier est en `"use server"` : uniquement des fonctions async
 * exportées. Une constante exportée ici ferait échouer le build.
 */

import { revalidatePath } from "next/cache";
import { read, write } from "@/lib/db/store";
import { listVisibleProducts } from "@/lib/actions/products";
import type { Product } from "@/lib/products";

const KEY = "storefront";

/** Bloc « La Maison » de l'accueil, entièrement rédigé depuis le back-office. */
export interface MaisonSection {
  /**
   * Titre du bloc. Les retours à la ligne sont conservés à l'affichage :
   * c'est ce qui permet de casser la phrase là où la typographie l'exige,
   * sans quoi le titre se replierait n'importe où selon la largeur d'écran.
   */
  titre: string;
  /** Corps du texte. Une ligne vide sépare deux paragraphes. */
  texte: string;
  /** Visuel d'accompagnement. Vide = le bloc s'affiche sans image. */
  image: string;
  /** Texte alternatif de l'image, lu par les lecteurs d'écran. */
  alt: string;
}

interface StorefrontSettings {
  /** Slug du modèle affiché dans le hero. Vide = premier mis en avant. */
  heroSlug: string;
  /**
   * Date limite de l'offre, au format `AAAA-MM-JJ`. Vide = aucune échéance
   * affichée.
   *
   * ⚠️ C'est une date FIXE, que le gérant repousse lui-même. Elle a remplacé
   * un calcul « aujourd'hui + 5 jours » : une échéance qui se repousse toute
   * seule à chaque visite annonce faussement la fin d'une offre, ce que
   * l'article L121-4, 7° du Code de la consommation répute trompeur en toutes
   * circonstances.
   */
  offerDeadline: string;
  /** Bloc « La Maison » — voir {@link MaisonSection}. */
  maison: MaisonSection;
}

/**
 * Texte d'origine du bloc « La Maison ».
 *
 * ⚠️ Sert de valeur de départ UNIQUEMENT tant que le gérant n'a rien
 * enregistré : `read()` ne re-seede pas une clé déjà écrite. Modifier ces
 * lignes après le premier enregistrement n'a plus aucun effet sur le site.
 */
const MAISON_DEFAUT: MaisonSection = {
  titre: "Le titre du récit\nde la marque.",
  texte: [
    "Ce bloc raconte la marque sur la page d'accueil et sur chaque fiche produit. Il se réécrit entièrement depuis le tableau de bord, sans toucher au code — titre, texte et visuel.",
    "Écrire ici ce que personne d'autre ne peut écrire : d'où vient la marque, ce qu'elle refuse de faire, ce qui la distingue. Un texte générique ne convainc personne et ne se référence pas.",
    "Une ligne vide sépare deux paragraphes. Les retours à la ligne du titre sont conservés à l'affichage : ils cassent la phrase là où la typographie l'exige.",
  ].join("\n\n"),
  image: "",
  alt: "",
};


const DEFAUT: StorefrontSettings = {
  heroSlug: "eclipse",
  offerDeadline: "",
  maison: MAISON_DEFAUT,
};

export async function getStorefrontSettings(): Promise<StorefrontSettings> {
  // Fusion avec les valeurs par défaut : une clé écrite avant l'ajout d'un
  // réglage n'en contient pas le champ, et renverrait `undefined`.
  const stocke = await read<StorefrontSettings>(KEY, DEFAUT);
  return {
    ...DEFAUT,
    ...stocke,
    // ⚠️ Fusion à DEUX niveaux : l'étalement ci-dessus remplace `maison` en
    // bloc. Une clé enregistrée avant l'ajout d'un champ (`alt`, par exemple)
    // le rendrait `undefined`, et l'accueil s'afficherait avec un trou.
    maison: { ...MAISON_DEFAUT, ...stocke?.maison },
  };
}

export async function setOfferDeadline(date: string): Promise<void> {
  const current = await getStorefrontSettings();
  // Format attendu : AAAA-MM-JJ, ou vide pour n'afficher aucune échéance.
  const clean = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
  await write(KEY, { ...current, offerDeadline: clean });
  // ⚠️ `"layout"` et non la page seule : l'échéance s'affiche sur l'accueil ET
  // sur chaque fiche produit, toutes générées en statique. Sans ça, le
  // changement n'apparaîtrait qu'au prochain déploiement.
  revalidatePath("/", "layout");
}

export async function setHeroSlug(slug: string): Promise<void> {
  const current = await getStorefrontSettings();
  await write(KEY, { ...current, heroSlug: slug });
  revalidatePath("/");
  revalidatePath("/admin");
}

/**
 * Enregistre le bloc « La Maison ».
 *
 * Les champs sont ébarbés mais jamais réécrits : ce texte est la voix de la
 * marque, et une « correction » automatique la trahirait. Seul garde-fou :
 * un titre ou un texte vidé par mégarde reprend la version d'origine plutôt
 * que de laisser un blanc en pleine page d'accueil.
 */
export async function setMaison(section: MaisonSection): Promise<void> {
  const current = await getStorefrontSettings();
  const titre = section.titre.trim();
  const texte = section.texte.trim();
  await write(KEY, {
    ...current,
    maison: {
      titre: titre || MAISON_DEFAUT.titre,
      texte: texte || MAISON_DEFAUT.texte,
      image: section.image.trim(),
      alt: section.alt.trim(),
    },
  });
  revalidatePath("/");
  revalidatePath("/admin");
}

/**
 * Le modèle à afficher dans le hero.
 *
 * Se rabat toujours sur un produit RÉELLEMENT visible : si le modèle choisi
 * est masqué ou supprimé depuis le back-office, un hero vide passerait
 * inaperçu en préproduction et sauterait aux yeux en production.
 */
export async function getHeroProduct(): Promise<Product | undefined> {
  const [{ heroSlug }, products] = await Promise.all([
    getStorefrontSettings(),
    listVisibleProducts(),
  ]);
  return (
    products.find((p) => p.slug === heroSlug) ??
    products.find((p) => p.featured) ??
    products[0]
  );
}
