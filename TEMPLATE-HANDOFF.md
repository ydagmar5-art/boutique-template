# Modèle de boutique — dossier de reprise

> ⚠️ **Mis à niveau le 19 août 2026 depuis Maison Romy Paris**, boutique en
> production. Le modèle porte désormais tout ce qui y avait été corrigé :
> quatre passerelles fonctionnelles, Apple Pay, webhooks de rattrapage,
> réglage du quota d'images, blog, collections, SEO, statistiques.
>
> **Les pièges rencontrés sont documentés dans le skill `/new-store`**, section
> « Leçons de Maison Romy Paris ». Les lire avant de brancher un PSP : chacun
> vient d'un défaut qui a atteint un site en ligne.

> Moteur e-commerce white-label. Next.js 15 (App Router, TS, Tailwind v3) · Supabase Postgres · Vercel.
> **Ce dossier ne se déploie pas.** On le clone pour créer une boutique.
> Origine : extrait d'une boutique en production en juillet 2026, après validation en production.

## 0. À lire en premier

**Tu es probablement une session Claude qui ouvre ce dossier sans contexte.** Ce fichier ne décrit pas ce que le code dit déjà — il contient la frontière à ne pas franchir, les pièges qui ont déjà coûté cher, et la checklist d'une mise en ligne.

**Le client ne code pas et n'édite aucun fichier.** Il décrit la boutique qu'il veut ; tout le reste est ton travail, y compris l'infrastructure. Il répond en français, valide un plan avant les changements importants, et veut une vérification navigateur avant toute annonce de succès.

**Règles de travail :**
1. Après chaque modification : `npx tsc --noEmit` → `npm run build` → `vercel --prod --yes`.
2. Vérifier dans le navigateur **en texte** (`get_page_text`, `read_page`, `javascript_tool`). Les captures d'écran coûtent cher — n'en prendre que pour un rendu visuel réellement en question.
3. Commits sous l'identité git configurée pour la boutique, jamais l'adresse personnelle du client.
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

- **Catalogue** : `Product.hidden` retire un produit de la boutique (listes + fiche en **404**) sans le supprimer — bouton *Masquer/Afficher* dans `/admin/products`. La vitrine passe par `listVisibleProducts()` / `getVisibleProduct()`, le back-office par `listProducts()` (qui voit tout). ⚠️ Une vitrine réécrite qui appellerait `listProducts()` **afficherait les produits masqués**.
- **Photos produit** : `components/admin/ImageUploader.tsx` (glisser-déposer, réordonnancement, 1ʳᵉ image = principale). Le navigateur convertit en WebP 1600 px avant l'envoi ; `next.config.mjs` relève `serverActions.bodySizeLimit` à 10 Mo. Stockage : `lib/db/media.ts` → bucket Supabase **`<prefix>-media`**, créé au premier upload, repli `public/uploads` en dev. ⚠️ Le bucket est **préfixé comme les tables** : un bucket commun ferait apparaître les photos d'une boutique dans le back-office d'une autre.
- **Galerie fiche produit** : `components/shop/ProductGallery.tsx` affiche **toutes** les photos (vignettes, flèches, clavier). Cadre fixe **portrait 3/4** en `object-cover`, choisi parce que c'est le format de sortie le plus courant des photos produit. ⚠️ Les photos très allongées (9/16) perdent ~26 % de hauteur : **cadrer le sujet au centre**. Même contrainte sur `ProductCard` (cover 4/5) → la **1ʳᵉ photo doit être en portrait**.
- **Données = JSON en base**, pas de schéma relationnel : `lib/db/store.ts` `read/write` → table `<prefix>_kv (key, value jsonb)`. Repli fichier `./data` si Supabase n'est pas configuré. Clés : `products`, `orders`, `customers`, `users`, `gateways`, `pixels`, `categories`, `pending_*`, `lock_*`.
- **Actions serveur** : `lib/actions/{products,orders,categories,settings,pixels,auth,analytics,checkout}.ts`.
- **Analytics** : tables `<prefix>_visits` et `<prefix>_visitors` (vrai schéma SQL, pas du KV) + présence temps réel Supabase. Schéma versionné dans `supabase/schema.sql` (RLS activée, **aucune policy** : seule la clé service role accède aux données — ajouter une policy de lecture publique exposerait les commandes et les clients).
- ⚠️ **Le projet Supabase est PARTAGÉ** entre les boutiques *et une application sans rapport*. Toute requête SQL doit filtrer sur le préfixe. Jamais de `drop`/`truncate` global.
- ⚠️ `"use server"` = **uniquement des fonctions async exportées**. Une constante exportée dans un tel fichier fait échouer le build (mettre les constantes à part, ex. `lib/pixels-types.ts`).
- ⚠️ Postgres réordonne les clés d'un `jsonb`. `read()` ne re-seede que si la clé est **absente** → pour rejouer un seed, supprimer la clé en base.

---

## 3 bis. Offres & codes promo

Une **seule** entité (`lib/promotions.ts`, `Promotion`) couvre les deux besoins : sans `code` elle s'applique toute seule, avec un `code` le client doit le saisir au paiement. Mécaniques : `bogo` (X achetés / Y offerts ou remisés), `percent`, `amount` — ciblables sur tout le catalogue, une catégorie ou des produits choisis, avec panier minimum, dates et quota.

- 🔒 **Le calcul se fait dans `validateCart()`**, jamais côté navigateur : une remise calculée sur un panier non vérifié se contourne aussi facilement qu'un prix falsifié (cf. §4).
- **Arbitrage produit** : une seule offre AUTOMATIQUE s'applique — la plus avantageuse pour le client ; un code promo se **cumule** par-dessus et porte sur le total déjà remisé.
- Dans un `bogo`, ce sont les articles **les moins chers** qui sont offerts (usage du commerce, et seule lecture qui ne fasse pas perdre d'argent).
- ⚠️ Le quota (`usageCount`) se décompte dans `createOrder`, donc **derrière le verrou** `createOrderOnce` — jamais à l'affichage du panier, qu'un simple rechargement épuiserait.
- ⚠️ Les PSP qui figent un montant à l'avance (Fondy, Airwallex) reçoivent le code promo : sans lui leur jeton porterait le prix non remisé. Leur widget est remonté quand le code change.
- Le moteur est couvert par 23 cas de test (BOGO, prix mixtes, cumul, quota, dates, plancher à 0).

## 4. Paiements — les trois règles non négociables

Le hub gère 10 passerelles ; **5 sont réellement câblées** : Stripe (Payment Element), Square (Web Payments SDK), Fondy (checkout embarqué), **Airwallex** (Card Element embarqué) et **Genome** (page hébergée, redirection). Les autres (Zen, Viva, myPOS, Whop) n'ont que leurs champs de configuration. ⚠️ Airwallex et Genome sont câblés et testés techniquement mais **aucun paiement réel n'y est jamais passé** — à valider en sandbox avant le live.

### 4.1 Le tunnel ne connaît AUCUN PSP — comment en brancher un
`components/shop/CheckoutClient.tsx` ne contient aucun `if (stripe)… if (square)…`. Il demande au registre `components/shop/payment/registry.tsx` si le PSP actif sait encaisser **sur place** ; sinon il redirige. **Brancher un PSP embarqué = 3 gestes, sans toucher au tunnel** :
1. `lib/payments/public-config.ts` → les clés **publiques** envoyées au navigateur (jamais un secret) ;
2. `registry.tsx` → une entrée `Fields` + un `confirm(ctx) → { orderId | error | handled }` (`handled` = le PSP a pris la main sur la navigation, cas Fondy/3-DS : **ne pas vider le panier**) ;
3. une action serveur qui encaisse.

Le mode est **déduit** : config publique exploitable → `embedded`, sinon → `redirect`. Clés incomplètes = redirection propre, jamais un widget mort. `hostedFallback: true` (Fondy) indique que `startCheckout` sait basculer sur la page hébergée ; sans lui, un widget en échec affiche « Paiement indisponible » plutôt qu'une redirection qui n'aboutirait pas.

⚠️ **N'inscrire au registre que des PSP dont les champs carte sont hébergés par eux** (iframe/SDK). Un PSP dont la carte transiterait par nos serveurs ferait basculer la boutique en **PCI DSS SAQ-D** (audit annuel, scans trimestriels). C'est pourquoi **Genome reste en redirection** : sa page hébergée n'est pas embarquable, son SDK sans redirection est **mobile**, et son mode Host-to-Host exige que la carte passe par le marchand.

### 4.2 Airwallex — les deux pièges
- ⚠️ **Airwallex compte en unités MAJEURES** (`"amount": 100` = 100 €) alors que la boutique compte en **centimes**. `toMajorUnits()` fait la conversion : s'en écarter facturerait 100 × le prix.
- ⚠️ `createElement` s'importe **du module** `@airwallex/components-sdk`, il n'est pas sur le retour de `init()`. On utilise le **Card Element** (pas le Drop-in, qui apporte son propre bouton alors que le tunnel n'en a qu'un).
- L'événement de succès vient du navigateur : `finalizeAirwallexPayment` **relit l'intent** chez Airwallex (`SUCCEEDED` + montant identique) avant de créer la commande.

### 4.3 Genome — la signature est la seule preuve
- ⚠️ **Aucune API de statut** sur la page hébergée : impossible de revérifier un paiement après coup. Le **callback signé est la seule preuve d'encaissement** — `finalizeGenomePayment` ne doit jamais être appelé sans `genomeVerifyCallback`.
- ⚠️ **L'URL du callback ne se transmet pas dans la requête** : elle se déclare dans le tableau de bord Genome (`https://<domaine>/api/webhooks/genome`). Mettre le domaine **avec `www`** si le domaine nu redirige en 308 : rien ne garantit qu'un PSP suive une redirection sur un POST.
- JWT signé en HS256 avec le **SHA-256 en octets bruts** du secret (pas son hexadécimal).

- 💰 **Le panier du navigateur n'est qu'une demande.** Les lignes vivent dans le `localStorage` : prix unitaires et total s'y éditent en trois clics. Toute action qui encaisse passe donc par `validateCart()` (`lib/payments/cart.ts`), qui **relit le catalogue** et ne garde du client que le slug, la variante et la quantité — le nom, le prix et le total sont recalculés. Cela bloque aussi les produits masqués ou en rupture restés au panier. ⚠️ Les créations de jeton/intent (`createFondyToken`, `createAirwallexIntent`) prennent les **lignes**, jamais un montant : un montant reçu du navigateur serait figé tel quel dans le jeton signé. Vérifié en local : panier trafiqué à 2,00 € → commande enregistrée à 318,00 €.
- 🔒 **Une commande = un paiement.** Chaque PSP annonce un paiement **deux fois** : le navigateur qui revient, et le webhook serveur — à quelques millisecondes d'écart. Le motif « lire → tester `done` → créer → écrire » **ne suffit pas** : les deux passent le test et créent chacun une commande. C'est arrivé en production. Toute finalisation passe donc par `createOrderOnce()` (`lib/payments/finalize.ts`), qui s'appuie sur l'unicité de clé primaire Postgres (`acquireLock`). **Ne jamais créer une commande hors de ce passage.**
- 🔢 **Numérotation = plus grand numéro attribué + 1**, jamais « nombre de commandes + 1 » : le compte rejoue un numéro après chaque suppression. Deux commandes ont ainsi porté le même identifiant, dont l'une inaccessible et impossible à supprimer séparément.
- **3-D Secure actif sur les trois PSP**, sans quitter le site : modale Stripe · modale ACS du widget Fondy · `payments.verifyBuyer()` chez Square. Si le défi échoue ou est abandonné, **on n'encaisse pas** — c'est voulu.
- ✅ **Une seule passerelle active à la fois** (`saveGateway`) : en activer une éteint automatiquement les autres. L'ordre de `brand.payments` ne décide donc plus de rien — l'ancien piège « Test activé passe avant tout le monde » n'existe plus.
- ✅ **Activation refusée si des clés manquent.** Sans repli possible (une seule passerelle), activer un PSP mal configuré coupe les ventes en silence : le client ne le découvre qu'au clic sur « Payer », avec un message « Clés … manquantes ». **C'est arrivé deux fois en production.** `saveGateway` renvoie désormais `{ ok:false, error }` et la carte réaffiche l'interrupteur éteint. ⚠️ **Ne protège que les nouvelles activations** : une passerelle déjà active en base le reste.
- ⚠️ **Clés test/live partagées** : `credentials` est un dictionnaire unique, mêmes noms de champs dans les deux onglets. Les clés live **écrasent** les clés test, et un champ laissé vide **conserve l'ancienne valeur** → oublier le secret de webhook live laisse celui de test et fait rejeter toutes les signatures. Remplir les champs d'un bloc.
- ❌ **Stripe Embedded Checkout : essayé, refusé, ne pas y revenir.** Il impose un tunnel en deux étapes.

---

## 5. Checklist de mise en ligne

**Le plus simple : la skill `/new-store`**, qui déroule tout ce qui suit. Sinon, à la main :

**Automatisable (à faire) :**
1. `node scripts/create-store.mjs --prefix <p> --name "<Nom>" --dir <chemin>` — copie le modèle, écrit le préfixe, crée les 3 tables Supabase, initialise git avec le modèle en amont (`upstream`) et génère `.env.local` avec un `AUTH_SECRET`
2. Compléter `.env.local`, puis `npm install`
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

## 6 bis. Ce que le tunnel envoie à l'extérieur

Trois briques ajoutées en août 2026, toutes remontées depuis une boutique
réelle. Elles valent pour **toute** boutique du modèle.

### Identité transmise aux processeurs — `lib/payments/identity.ts`

Un paiement qui n'arrive chez le PSP qu'avec un montant et un e-mail prive la
boutique de trois choses : le contrôle « adresse de la carte vs adresse de
livraison » (le signal anti-fraude le plus discriminant), les preuves qui
gagnent un litige « colis non reçu », et la respectabilité du compte marchand
— un flux sans nom ni adresse ressemble, dans les outils de risque, à une
passerelle qui encaisse pour un tiers.

| PSP | Ce qui part | Quand |
|---|---|---|
| **Stripe** | `shipping` + `metadata` | à la création du PaymentIntent |
| **Airwallex** | `order.shipping` via `/payment_intents/{id}/update` | juste avant la confirmation (l'intent naît au montage des champs carte) |
| **Fondy** | `reservation_data` (base64) | à la création du lien |
| **Genome** | claims `VALUE_FIRST_NAME`, `VALUE_PHONE`, `VALUE_ADDRESS`… | à la signature du JWT |

⚠️ **Fondy n'accepte que des caractères latins non accentués** et rejette la
requête entière sur un « é ». D'où `sansAccent()`. Sur une boutique française,
l'oublier casse tous les paiements Fondy.

⚠️ **Aucun de ces appels ne doit pouvoir empêcher un paiement.** Fondy rejoue
sans l'identité si elle est refusée, Airwallex journalise et continue.

⚠️ **Fondy embarqué reste sans identité** : son jeton est signé au MONTAGE du
widget, avant toute saisie, et il n'existe pas d'API pour le compléter.

### Suivi remonté au PSP — `lib/payments/tracking.ts`

Au passage en « expédiée », transporteur et numéro partent vers le PSP.
`Order.pspRef` sert de clé. Stripe accepte `shipping.carrier` et
`shipping.tracking_number` après encaissement ; Airwallex les reçoit en
`metadata` (tentative, pas promesse) ; Fondy et Genome n'ont pas d'API pour ça.

La rumeur « sans numéro de suivi le PSP ferme le compte » est fausse. Ce qu'ils
surveillent est le **taux de litiges** (surveillance à 0,75 % chez Stripe,
fermeture à 1 %), et le suivi est la preuve qui gagne la catégorie de litige la
plus fréquente.

### Origine des ventes — `lib/attribution.ts`

Traduit référent et `utm_*` en canal : Pinterest, Snapchat, Instagram, TikTok,
Facebook, **Google/Bing (SEO)**, **IA (GEO)**, e-mail, publicité, direct.

⚠️ **Premier contact, pas dernier clic.** `memoriserSource()` n'écrit que si la
clé est absente : une visiteuse venue de Pinterest qui revient trois jours plus
tard en tapant le nom du site reste comptée en Pinterest. Sinon tout finirait
en « Direct ».

⚠️ **L'origine se lit sur la page d'ARRIVÉE**, avant tout filtrage de robots :
`memoriserSource()` est appelé en premier dans `Tracker`. Le référent n'existe
plus à la deuxième page.

⚠️ **Un nouveau PSP doit recopier `phone`, `pspRef` et `source` dans son appel
à `createOrder`**, sinon ses ventes remontent toutes en « Direct » et son suivi
ne part jamais.

---

## 7. Pièges connus (hérités, tous vérifiés en production)

- ⚠️ **Jamais `npm run build` pendant que `npm run dev` tourne** : le build écrase `.next/`, les chunks passent en 404, l'hydratation meurt (formulaires morts, CSS absent). Symptôme : `window.next === undefined`. Correctif : arrêter le dev, `rm -rf .next`, relancer.
- ⚠️ **Opacité Tailwind sur les couleurs de marque** : `bg-ink/40` sort **transparent** (une variable CSS ne peut pas recevoir d'alpha). Utiliser `bg-black/40`.
- ⚠️ **Les iframes tierces (Stripe, Fondy) apparaissent VIDES sur les captures d'écran** après un zoom, un défilement ou un redimensionnement : le panneau ne les repeint pas. Ne jamais en conclure à une régression — mesurer la hauteur de l'iframe (`getBoundingClientRect().height`). Ce faux négatif a déjà fait accuser à tort une dépendance.
- ⚠️ Un `<button>` dans un `<fieldset disabled>` est désactivé lui aussi — le sortir du fieldset.
- ⚠️ **Ne rien superposer au conteneur d'un formulaire de paiement** (squelette en overlay, `display:none`) : il s'initialise dans un conteneur mal dimensionné et reste vide.
- ⚠️ **Ajouter une colonne à une table déjà en service.** PostgREST rejette la requête ENTIÈRE quand on écrit dans une colonne inconnue. Une boutique dont la migration n'a pas encore été jouée cesse donc d'enregistrer ses visites — en silence, sans erreur visible, pour un simple ornement d'affichage. Tout code qui écrit une colonne récente doit tenter puis se désarmer (voir `colonneSource` dans `lib/actions/analytics.ts`). Et la clé de service ne permet PAS le DDL : la migration se joue à la main dans l'éditeur SQL de Supabase.
- ⚠️ **`upsert` réécrit la ligne entière.** Sur `<prefix>_visitors`, l'origine du visiteur serait donc écrasée à chaque retour, et tout finirait attribué à « Direct ». Toute donnée de PREMIER contact doit être relue puis préservée explicitement avant l'écriture.
- ⚠️ **Apple Pay et Google Pay : le piège du `www`.** Stripe n'affiche un portefeuille que sur un domaine ENREGISTRÉ, et `www.` est un sous-domaine distinct — « `www` is a subdomain that you must also register ». Quand la condition n'est pas remplie, **rien n'apparaît et aucune erreur n'est levée**. Vu en production : seul le domaine nu était déclaré alors que tout le trafic est redirigé en 308 vers `www`, donc Apple Pay était invisible pour 100 % des visiteuses. Contrôle : `curl -s https://api.stripe.com/v1/payment_method_domains -u "$STRIPE_SECRET_KEY:"`.
- ⚠️ **Apple exige que la fenêtre de paiement s'ouvre sur un geste utilisateur**, sans code long avant. Si le tunnel fait des allers-retours serveur entre le clic « Payer » et `confirmPayment`, la fenêtre peut ne pas s'ouvrir. La réponse est l'Express Checkout Element, qui porte son propre bouton.
- ⚠️ **Visiteuses fantômes en temps réel.** Supabase n'émet pas toujours l'événement `leave` : onglet fermé brutalement, veille, coupure réseau. La clé de présence restait et seul un rechargement nettoyait l'affichage. Corrigé : `Tracker` émet un battement toutes les 15 s qui rafraîchit `since`, et `LiveVisitors` écarte quiconque n'a rien émis depuis 50 s, en réévaluant toutes les 8 s. **Ne jamais faire dépendre l'affichage du seul événement `leave`.**
- ⚠️ **Un son de notification ne se fait PAS avec un AudioContext.** Son autorisation est fragile : il retombe en « suspended » en arrière-plan ou après inactivité, et le réveil hors d'un geste est refusé — or c'est en arrière-plan qu'une notification sert. Utiliser un élément `<audio>` **amorcé pendant un clic** (joué puis mis en pause aussitôt) : il reste rejouable par programme ensuite. Et toujours afficher l'état, sinon un son bloqué est indiscernable d'un son jamais déclenché.
- ⚠️ **Prix barré : règle des 30 jours.** `Product.compareAtPrice` est purement d'affichage — `price` reste le seul montant débité. Mais en France le prix de référence doit être le prix le plus bas réellement pratiqué dans les 30 jours précédents (art. L112-1-1, directive Omnibus) : un ancien prix inventé est une pratique commerciale trompeuse, et un motif classique de fermeture chez les PSP.
- ⚠️ **Tester une commande envoie un vrai e-mail au gérant.** Renseigner `MERCHANT_EMAIL` dans `.env.local` pendant les tests.
- ⚠️ **`InitiateCheckout` n'était appelé nulle part** jusqu'en août 2026 : l'événement existait dans `lib/pixel-events.ts` mais aucun composant ne le déclenchait. L'entonnoir publicitaire sautait la marche entre l'ajout au panier et l'achat. Corrigé dans `CheckoutClient`. **Toute boutique clonée avant cette date a le trou** — vérifier avant de conclure à un problème de pixel.
- ⚠️ **Le montant d'`InitiateCheckout` attend le devis serveur** : les offres s'appliquent côté serveur, partir sur le total local annonce plus que ce qui sera encaissé. Repli à 1,5 s pour ne jamais perdre l'événement.
- ⚠️ **Un secret ne se range JAMAIS dans `PixelConfig`** : cette structure est passée à `PixelScripts`, qui recopie ses valeurs en clair dans le HTML. Pour un jeton serveur (API Conversions par exemple), prévoir un stockage séparé sur le modèle de `lib/payments/gateway-store.ts`.
- ⚠️ **Google Ads ne compte pas l'événement `purchase` de GA4.** Il lui faut son propre événement `conversion` adressé à `send_to: "AW-xxx/libellé"`. L'identifiant `AW-` seul dans le back-office charge la balise et fait remonter le trafic — mais **zéro conversion**, donc des enchères automatiques aveugles. D'où deux champs distincts (`googleAds` + `googleAdsLabel`) et l'avertissement quand un seul est rempli : sans lui, l'oubli ne se remarque qu'en constatant un tableau de bord vide plusieurs semaines plus tard.
- ⚠️ **GA4 et Google Ads sont deux identifiants distincts**, souvent présents tous les deux. Ils partagent la même balise `gtag.js` : la charger **une seule fois**, puis déclarer chaque identifiant par son propre `gtag('config', …)`. Un second chargement du script réinitialiserait la file `dataLayer` en cours de route.
- ⚠️ **L'ordre du tableau `products` EST l'ordre de la boutique.** Le gérant le règle en glissant les lignes dans `/admin/products` (`reorderProducts`). N'introduire **aucun tri automatique** — prix, nom, date — sur les listes vitrine : cela annulerait son classement sans prévenir.

---

## 8. Faire redescendre un correctif du noyau

Chaque boutique créée par le script a le modèle en amont. Pour lui porter une correction faite ici :

```bash
git fetch upstream && git merge upstream/main
```

Les conflits se limitent en principe à la peau (`config/*`, vitrine, catalogue), que la boutique possède. Si un conflit apparaît dans le noyau, c'est le signe qu'on a franchi la frontière de la §1.

---

## 8 bis. Reste à faire redescendre

Fait dans Maison Romy, pas encore dans le modèle — à porter au prochain
passage :

- **Le socle de référencement** : `lib/seo.ts` (canoniques, Open Graph,
  JSON-LD `Product`/`Offer`/`BreadcrumbList`/`Organization`), `metadataBase`,
  et `components/site/JsonLd.tsx`. C'est du noyau, valable pour toute
  boutique. ⚠️ La canonique est indispensable dès qu'on met des liens
  publicitaires avec `utm_*` : sans elle, chaque variante d'URL est une page
  dupliquée aux yeux de Google.
- **Pages de catégorie** (`lib/collections.ts`) : le modèle n'a qu'une page
  `/products` pour couvrir toutes les familles de produits, là où ce sont les
  pages de catégorie qui captent les termes réellement cherchés.
- **Palmarès produits** dans les statistiques, et le détail « total d'ajouts
  au panier / nombre de personnes ».

---

## 9. État du modèle

- Catalogue de démonstration : 4 produits neutres, visuels SVG de remplacement dans `public/products`.
- `seedOrders` et `seedCustomers` **volontairement vides** : une boutique neuve ne doit pas afficher de fausses commandes ni un faux chiffre d'affaires.
- Le formulaire newsletter de la page d'accueil **n'est pas branché**.
- Non implémentés, à décider par boutique : consentement cookies, favicon/image de partage, PSP restants.
- **Remontées d'une boutique en production (août 2026), vérifiées en local sur ce modèle** : produits masquables · uploader d'images glisser-déposer · galerie produit multi-photos · tunnel de paiement générique (registre) · Airwallex embarqué · Genome en redirection · une seule passerelle active à la fois + refus d'activation sans clés.
- ⚠️ **Panier non revalidé côté serveur au paiement** : `startCheckout` fait confiance aux prix et aux articles envoyés par le navigateur. Un client peut modifier le total avant l'envoi, et un produit masqué déjà au panier reste commandable. Les PSP embarqués recomparent le montant encaissé au montant figé, ce qui limite la casse, mais **la vraie correction est de recalculer le panier depuis le catalogue serveur** — à faire.
