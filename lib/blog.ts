/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  BLOG — référencement classique ET citation par les IA (GEO)     ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Deux publics, une seule structure.
 *
 * POUR GOOGLE : des pages qui répondent à une requête précise, avec des
 * titres de section qui reprennent la question posée, et des liens internes
 * vers les pages de ligne.
 *
 * POUR LES ASSISTANTS (ChatGPT, Perplexity, Claude, Gemini) : ce qui est
 * repris est une phrase courte, autonome et factuelle — pas un paragraphe
 * commercial. D'où le champ `reponseCourte` : deux ou trois phrases qui
 * répondent SANS contexte, immédiatement sous le titre. C'est le bloc que ces
 * moteurs citent, et le seul qui puisse l'être : une réponse noyée au milieu
 * d'un texte de marque n'est jamais extraite.
 *
 * ⚠️ Le champ `faq` alimente un balisage `FAQPage`. Il ne doit contenir que
 * des questions RÉELLEMENT posées et traitées sur la page — un balisage qui
 * ne correspond pas au contenu visible est une manipulation, sanctionnée.
 *
 * ⚠️ RÈGLES DE CONTENU (HANDOFF §2) : jamais « Fabrication française », rien
 * sur le fournisseur, aucun émoji. Et aucun conseil qu'on ne peut pas tenir :
 * un conseil d'entretien faux se retourne contre la maison le jour où un cuir
 * est abîmé.
 */

export interface QuestionReponse {
  question: string;
  reponse: string;
}

export interface Section {
  /** Formulé en question quand c'en est une : c'est ce qui se cite. */
  titre: string;
  paragraphes: string[];
  /** Liste à puces facultative — très bien reprise par les assistants. */
  liste?: string[];
  /** Visuel illustrant la section. Chemin public, ex. `/products/alis-6.webp`. */
  image?: string;
  imageAlt?: string;
}

export interface Article {
  slug: string;
  titre: string;
  titreSeo: string;
  description: string;
  /**
   * Réponse autonome, 2 à 3 phrases. ⚠️ Doit se suffire à elle-même : si on
   * la lit seule, hors du site, elle doit rester juste et compréhensible.
   */
  reponseCourte: string;
  chapeau: string;
  publieLe: string;
  majLe: string;
  sections: Section[];
  faq: QuestionReponse[];
  /** Slugs de lignes proposés en fin de lecture. */
  lignes: string[];
  /**
   * Visuel de couverture — vignette de la grille, image de l'article, et
   * image Open Graph. Choisi pour ILLUSTRER LE PROPOS : une macro de cuir
   * pour l'entretien, un porté pour le choix, un détail pour la qualité.
   */
  image: string;
  imageAlt: string;
}

/**
 * Articles du blog.
 *
 * ⚠️ VIDE PAR DÉFAUT. Le blog est un levier de référencement réel, mais un
 * article générique ne sert à rien : il faut du contenu propre à la niche,
 * écrit à partir des questions que se posent VRAIMENT les clientes.
 *
 * La structure `Section` accepte titres, paragraphes, listes et blocs
 * question/réponse — ces derniers sont ce que les assistants de recherche
 * extraient en priorité (GEO). Les pages `/blog` et `/blog/[slug]` gèrent
 * d'elles-mêmes le cas d'un tableau vide.
 */
export const ARTICLES: Article[] = [];

export const articleParSlug = (slug: string) =>
  ARTICLES.find((a) => a.slug === slug);

/** Temps de lecture, en minutes — 200 mots/minute, arrondi au supérieur. */
export function tempsLecture(a: Article): number {
  const mots = [
    a.chapeau,
    a.reponseCourte,
    ...a.sections.flatMap((s) => [s.titre, ...s.paragraphes, ...(s.liste ?? [])]),
    ...a.faq.flatMap((f) => [f.question, f.reponse]),
  ]
    .join(" ")
    .split(/\s+/).length;
  return Math.max(1, Math.ceil(mots / 200));
}
