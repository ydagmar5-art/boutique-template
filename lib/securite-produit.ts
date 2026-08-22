/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  SÉCURITÉ PRODUIT — RÈGLEMENT (UE) 2023/988 (« GPSR »)           ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * ⚠️ OBLIGATION LÉGALE, APPLICABLE DEPUIS LE 13 DÉCEMBRE 2024, et l'un des
 * motifs de désapprobation les plus récents chez Google Merchant Center
 * (« avertissement de conformité » sur les articles vendus dans l'UE).
 *
 * Ce que le règlement impose à une offre en ligne (art. 19) :
 *   1. le nom, l'adresse postale et l'adresse électronique du FABRICANT ;
 *   2. lorsque le fabricant n'est pas établi dans l'Union — c'est notre cas —
 *      les mêmes coordonnées d'un OPÉRATEUR ÉCONOMIQUE ÉTABLI DANS L'UNION
 *      (art. 16), qui répond de la conformité du produit ;
 *   3. les éléments d'identification du produit (modèle, référence) ;
 *   4. les avertissements et informations de sécurité, en français.
 *
 ⚠️ SI L'EXPLOITANT EST IMMATRICULÉ HORS DE L'UNION (Royaume-Uni, Suisse,
 * États-Unis…), un opérateur économique établi dans l'UE est OBLIGATOIRE :
 * sans lui, le produit ne peut légalement pas être mis à disposition sur le
 * marché français. Ce n'est pas une formalité d'affichage, c'est une
 * condition de commercialisation.
 *
 * ⚠️ NE RIEN INVENTER ICI. Un nom de fabricant approximatif, une adresse
 * recopiée d'une fiche AliExpress ou un avertissement rédigé « au mieux » sont
 * pires que le vide : ils engagent l'exploitant sur des mentions fausses et
 * font tomber la conformité au premier contrôle. Tant que les champs restent
 * vides, la section ne s'affiche pas — et c'est le comportement voulu.
 *
 * À RENSEIGNER avec les informations transmises par le fournisseur :
 * déclaration UE de conformité, marquage CE, notice, coordonnées du fabricant
 * et du mandataire européen.
 */

export interface OperateurEconomique {
  nom: string;
  adresse: string;
  email: string;
}

export interface SecuriteProduit {
  /** Fabricant réel, tel qu'inscrit sur la déclaration de conformité. */
  fabricant: OperateurEconomique | null;
  /**
   * Opérateur économique établi dans l'Union (mandataire, importateur ou
   * prestataire de services d'exécution des commandes), art. 16 du règlement.
   * ⚠️ OBLIGATOIRE tant que le fabricant est hors UE.
   */
  representantUE: OperateurEconomique | null;
  /** Référence commerciale du modèle, telle qu'imprimée sur l'appareil. */
  modele: string;
  /** Avertissements de sécurité, repris de la notice du fabricant. */
  avertissements: string[];
  /** Marquages et certifications réellement obtenus (« CE », « RoHS »…). */
  marquages: string[];
}

export const securiteProduit: SecuriteProduit = {
  /**
   * ⚠️ À RENSEIGNER PAR CHAQUE BOUTIQUE, avec la déclaration UE de conformité
   * du fournisseur. Tant que tout est vide, la section ne s'affiche pas.
   */
  fabricant: null,
  representantUE: null,
  modele: "",
  avertissements: [],
  marquages: [],
};

/** Vrai quand il y a assez d'informations pour afficher la section. */
export const securiteRenseignee =
  securiteProduit.fabricant !== null ||
  securiteProduit.representantUE !== null ||
  securiteProduit.avertissements.length > 0;
