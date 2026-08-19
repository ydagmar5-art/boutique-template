import { jsonLd } from "@/lib/seo";

/**
 * Injecte un bloc de données structurées.
 *
 * ⚠️ `dangerouslySetInnerHTML` est ici le SEUL moyen : React échapperait le
 * JSON en entités HTML, que les moteurs ne savent pas relire. Le risque
 * d'injection est neutralisé en amont par `jsonLd()`, qui remplace « < » par
 * son échappement — sans quoi une description contenant « </script> »
 * fermerait la balise.
 */
export default function JsonLd({ donnees }: { donnees: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLd(donnees) }}
    />
  );
}
