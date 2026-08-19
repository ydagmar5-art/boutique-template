import type { MetadataRoute } from "next";
import { listVisibleProducts } from "@/lib/actions/products";
import { LIGNES } from "@/lib/collections";
import { ARTICLES } from "@/lib/blog";

/**
 * Plan du site.
 *
 * ⚠️ Alimenté par `listVisibleProducts()` et non par le catalogue de départ :
 * un modèle masqué depuis le back-office renvoie une 404, et le déclarer au
 * sitemap ferait remonter des erreurs d'exploration dans Search Console.
 */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "";
  if (!site) return [];

  const now = new Date();
  const fixes: { url: string; priority: number }[] = [
    { url: "", priority: 1 },
    { url: "/products", priority: 0.9 },
    { url: "/livraison", priority: 0.5 },
    { url: "/contact", priority: 0.5 },
    { url: "/remboursement", priority: 0.4 },
    { url: "/cgv", priority: 0.3 },
    { url: "/cgu", priority: 0.2 },
    { url: "/confidentialite", priority: 0.2 },
    { url: "/mentions-legales", priority: 0.2 },
  ];

  const produits = await listVisibleProducts();

  return [
    ...fixes.map((f) => ({
      url: `${site}${f.url}`,
      lastModified: now,
      priority: f.priority,
    })),
    /*
      Pages de ligne — priorité au-dessus des fiches : ce sont elles qui
      visent les termes réellement cherchés (« cabas en cuir », « sac seau »),
      là où une fiche ne capte que son propre modèle.
    */
    ...LIGNES.map((l) => ({
      url: `${site}/collections/${l.slug}`,
      lastModified: now,
      priority: 0.85,
    })),
    { url: `${site}/blog`, lastModified: now, priority: 0.7 },
    ...ARTICLES.map((a) => ({
      url: `${site}/blog/${a.slug}`,
      lastModified: new Date(a.majLe),
      priority: 0.65,
    })),
    /*
      Les visuels sont déclarés avec chaque fiche : c'est ce qui les rend
      éligibles à Google Images, un canal réel pour de la maroquinerie.
      Next.js les transforme en balises <image:image> du plan de site.
    */
    ...produits.map((p) => ({
      url: `${site}/products/${p.slug}`,
      lastModified: now,
      priority: 0.8,
      images: p.images.map((i) => `${site}${i}`),
    })),
  ];
}
