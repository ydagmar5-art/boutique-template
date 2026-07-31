# Modèle de boutique — dossier de reprise

> Moteur e-commerce white-label. Next.js 15 (App Router, TS, Tailwind v3) · Supabase Postgres · Vercel.
> **Ce dossier ne se déploie pas.** On le clone pour créer une boutique.
> Origine : extrait d'AURA (atelier-aura-design.store) en juillet 2026, après validation en production.

## 0. À lire en premier

**Tu es probablement une session Claude qui ouvre ce dossier sans contexte.** Ce fichier ne décrit pas ce que le code dit déjà — il contient la frontière à ne pas franchir, les pièges qui ont déjà coûté cher, et la checklist d'une mise en ligne.

**Le client ne code pas et n'édite aucun fichier.** Il décrit la boutique qu'il veut ; tout le reste est ton travail, y compris l'infrastructure. Il répond en français, valide un plan avant les changements importants, et veut une vérification navigateur avant toute annonce de succès.

**Règles de travail :**
1. Après chaque modification : `npx tsc --noEmit` → `npm run build` → `vercel --prod --yes`.
2. Vérifier dans le navigateur **en texte** (`get_page_text`, `read_page`, `javascript_tool`). Les captures d'écran coûtent cher — n'en prendre que pour un rendu visuel réellement en question.
3. Commits en identité **ydagmar5-art**, jamais avec l'adresse personnelle du client.
4. Ne jamais annoncer qu'une chose fonctionne sans l'avoir constatée.

---

## 1. La frontière — le point le plus important du fichier

Le dépôt est coupé en deux. **Cette séparation est ce qui permet de rhabiller une boutique sans casser le moteur, et de faire redescendre un correctif dans toutes les boutiques déjà lancées.**

| 🔒 LE NOYAU — ne pas réécrire | 🎨 LA PEAU — réécrite à chaque boutique |
|---|---|
| `lib/` (données, paiements, e-mails, auth, analytics) | `app/(storefront)/page.tsx` et les pages vitrine |
| `app/admin/` (tout le back-office) | `components/site/Logo.tsx` |
| `app/api/` (webhooks, retours PSP) | `config/brand.config.ts` (identité, palette) |
| `components/admin/`, `components/shop/` (paiement) | `config/fonts.ts`, `config/store.config.ts` |
| | `lib/products.ts` (catalogue), `public/` |

Une correction de bug touche le noyau et se propage à toutes les boutiques. Un changement de style touche la peau et ne concerne qu'une boutique. **Si tu te retrouves à modifier le noyau pour un besoin esthétique, c'est le signe qu'il manque un point de configuration — ajoute-le plutôt que de faire diverger le fichier.**

### Ce qu'une vitrine réécrite doit CONSERVER

C'est le vrai risque du « copie tel site » : une vitrine refaite de zéro a l'air parfaite et ne mesure plus rien. À vérifier systématiquement après une refonte :

| Élément | Où | Ce qui casse sans lui |
|---|---|---|
| `<Tracker />` | layout storefront | Plus aucune visite ni visiteur en direct dans `/admin/stats` |
| `<RouteChangePixel />` | layout storefront | Les scripts pixels ne se rejouent pas en navigation client : **une session entière ne compte qu'une seule vue** |
| `<PixelScripts />` | layout storefront | Aucun pixel publicitaire ne se charge |
| `<ClearCart />` | page `/order/[id]` | Le panier n'est jamais vidé après un achat |
| `<PurchasePixel />` | page `/order/[id]` | Aucune conversion remontée aux régies |
| `listProducts()` / `listFeatured()` | pages catalogue | Un catalogue écrit en dur : l'admin ne pilote plus rien |
| `<ProductCard>` | grilles produits | Lien vers la fiche et formatage du prix perdus |
| `useCart` (`lib/cart/store.ts`) | ajout au panier | Panier non persistant, événement `cart_add` perdu |
| `<Reveal>` | animations | Une animation maison ignore `prefers-reduced-motion` |

---

## 2. Les 4 fichiers à renseigner pour une nouvelle boutique

| Fichier | Contenu | Piège |
|---|---|---|
| `config/store.config.ts` | **Préfixe technique** : tables, cookies, clé du panier, numérotation | Deux boutiques qui partagent un préfixe partagent leurs données |
| `config/brand.config.ts` | Nom, palette (11 couleurs), navigation, **mentions légales** | Les 11 clés de couleur doivent toutes rester : une clé manquante casse le rendu sans erreur de compilation |
| `config/fonts.ts` | Typographie | `next/font` exige des imports **statiques** — la police ne peut pas venir de `brand.config` |
| `lib/products.ts` | Catalogue de départ | Les prix sont en **centimes** |

---

## 3. Architecture

- **Données = JSON en base**, pas de schéma relationnel : `lib/db/store.ts` `read/write` → table `<prefix>_kv (key, value jsonb)`. Repli fichier `./data` si Supabase n'est pas configuré. Clés : `products`, `orders`, `customers`, `users`, `gateways`, `pixels`, `categories`, `pending_*`, `lock_*`.
- **Actions serveur** : `lib/actions/{products,orders,categories,settings,pixels,auth,analytics,checkout}.ts`.
- **Analytics** : tables `<prefix>_visits` et `<prefix>_visitors` (vrai schéma SQL, pas du KV) + présence temps réel Supabase.
- ⚠️ `"use server"` = **uniquement des fonctions async exportées**. Une constante exportée dans un tel fichier fait échouer le build (mettre les constantes à part, ex. `lib/pixels-types.ts`).
- ⚠️ Postgres réordonne les clés d'un `jsonb`. `read()` ne re-seede que si la clé est **absente** → pour rejouer un seed, supprimer la clé en base.

---

## 4. Paiements — les deux règles non négociables

Le hub gère 9 passerelles ; **3 sont réellement câblées** : Stripe (Payment Element), Square (Web Payments SDK), Fondy (checkout embarqué). Les autres (Zen, Viva, myPOS, Whop, Airwallex) n'ont que leurs champs de configuration.

- 🔒 **Une commande = un paiement.** Chaque PSP annonce un paiement **deux fois** : le navigateur qui revient, et le webhook serveur — à quelques millisecondes d'écart. Le motif « lire → tester `done` → créer → écrire » **ne suffit pas** : les deux passent le test et créent chacun une commande. C'est arrivé en production. Toute finalisation passe donc par `createOrderOnce()` (`lib/payments/finalize.ts`), qui s'appuie sur l'unicité de clé primaire Postgres (`acquireLock`). **Ne jamais créer une commande hors de ce passage.**
- 🔢 **Numérotation = plus grand numéro attribué + 1**, jamais « nombre de commandes + 1 » : le compte rejoue un numéro après chaque suppression. Deux commandes ont ainsi porté le même identifiant, dont l'une inaccessible et impossible à supprimer séparément.
- **3-D Secure actif sur les trois PSP**, sans quitter le site : modale Stripe · modale ACS du widget Fondy · `payments.verifyBuyer()` chez Square. Si le défi échoue ou est abandonné, **on n'encaisse pas** — c'est voulu.
- ⚠️ **Ordre des passerelles** : `firstEnabledGateway` prend la **première activée** dans `brand.payments`. Si « Test » est activé, il passe avant toutes les autres et **tous les paiements sont simulés**.
- ⚠️ **Clés test/live partagées** : `credentials` est un dictionnaire unique, mêmes noms de champs dans les deux onglets. Les clés live **écrasent** les clés test, et un champ laissé vide **conserve l'ancienne valeur** → oublier le secret de webhook live laisse celui de test et fait rejeter toutes les signatures. Remplir les champs d'un bloc.
- ❌ **Stripe Embedded Checkout : essayé, refusé, ne pas y revenir.** Il impose un tunnel en deux étapes.

---

## 5. Checklist de mise en ligne

**Automatisable (à faire) :**
1. `config/store.config.ts` — préfixe unique de la boutique
2. Tables Supabase `<prefix>_kv`, `<prefix>_visits`, `<prefix>_visitors` (DDL via le token Management dans le trousseau macOS — ⚠️ header `User-Agent` obligatoire, sinon Cloudflare 1010)
3. `config/brand.config.ts` — identité, palette, **mentions légales réelles**
4. `config/fonts.ts`, `components/site/Logo.tsx`
5. Vitrine + catalogue + photos (WebP dans `public/products`)
6. Projet Vercel + variables d'environnement (dont `AUTH_SECRET`, cf. §6)
7. `npx tsc --noEmit` → `npm run build` → parcours complet en navigateur → `vercel --prod --yes`

**Manuel — le client doit s'en charger :**
- Achat du nom de domaine
- Vérification DNS du domaine dans Resend (sans quoi aucun e-mail ne part)
- Ouverture des comptes PSP (liés à une entité légale)
- Saisie des clés PSP dans `/admin/payments`

---

## 6. Sécurité — à ne pas oublier

- ⚠️ **`AUTH_SECRET` est obligatoire en production.** Sans lui, le cookie de session admin serait signé avec une chaîne publique présente dans ce dépôt — n'importe qui pourrait forger un accès au back-office. Le code s'en protège en tirant une clé **aléatoire** à chaque démarrage : le trou est fermé, mais l'administrateur est déconnecté à chaque déploiement. **Se faire déconnecter après un déploiement est LE symptôme d'un `AUTH_SECRET` manquant.** Générer avec `openssl rand -base64 32`.
- ⚠️ **Ne jamais commiter `.env.local`** (couvert par `.gitignore`, vérifier avant le premier commit d'une nouvelle boutique).
- ⚠️ **Mentions légales** : publier une boutique avec le SIREN ou l'adresse d'une autre entreprise est de la fausse information légale, et les PSP refusent l'ouverture de compte quand les mentions ne correspondent pas au titulaire.
- ⚠️ **Avis clients inventés** = pratique commerciale trompeuse (art. L121-2 du code de la consommation). Les avis de la vitrine sont des marqueurs à remplacer par de vrais retours, ou à supprimer.
- **Consentement cookies** : non implémenté. Dès que des pixels publicitaires sont actifs, il devient obligatoire (RGPD). Idéalement, ne charger `PixelScripts` qu'après acceptation.

---

## 7. Pièges connus (hérités, tous vérifiés en production)

- ⚠️ **Jamais `npm run build` pendant que `npm run dev` tourne** : le build écrase `.next/`, les chunks passent en 404, l'hydratation meurt (formulaires morts, CSS absent). Symptôme : `window.next === undefined`. Correctif : arrêter le dev, `rm -rf .next`, relancer.
- ⚠️ **Opacité Tailwind sur les couleurs de marque** : `bg-ink/40` sort **transparent** (une variable CSS ne peut pas recevoir d'alpha). Utiliser `bg-black/40`.
- ⚠️ **Les iframes tierces (Stripe, Fondy) apparaissent VIDES sur les captures d'écran** après un zoom, un défilement ou un redimensionnement : le panneau ne les repeint pas. Ne jamais en conclure à une régression — mesurer la hauteur de l'iframe (`getBoundingClientRect().height`). Ce faux négatif a déjà fait accuser à tort une dépendance.
- ⚠️ Un `<button>` dans un `<fieldset disabled>` est désactivé lui aussi — le sortir du fieldset.
- ⚠️ **Ne rien superposer au conteneur d'un formulaire de paiement** (squelette en overlay, `display:none`) : il s'initialise dans un conteneur mal dimensionné et reste vide.
- ⚠️ **Tester une commande envoie un vrai e-mail au gérant.** Renseigner `MERCHANT_EMAIL` dans `.env.local` pendant les tests.

---

## 8. État du modèle

- Catalogue de démonstration : 4 produits neutres, visuels SVG de remplacement dans `public/products`.
- `seedOrders` et `seedCustomers` **volontairement vides** : une boutique neuve ne doit pas afficher de fausses commandes ni un faux chiffre d'affaires.
- Le formulaire newsletter de la page d'accueil **n'est pas branché**.
- Non implémentés, à décider par boutique : consentement cookies, favicon/image de partage, PSP restants.
