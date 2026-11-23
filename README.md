# TSŪ

## Organisation du code

- `worker/storefront.mjs` rend l’accueil, les collections, les fiches et les pages d’information en HTML côté serveur.
- `worker/shop-profile.mjs` valide et enregistre les coordonnées publiques et les réglages de livraison.
- `worker/checkout.mjs` crée les sessions Stripe en mode test et synchronise les commandes d’essai.
- `worker/printful.mjs` gère la connexion Printful et l’import des produits en brouillon.
- `worker/account.mjs` gère le compte propriétaire.
- `dist/shop.js` et `dist/cart.js` gèrent le panier et le parcours d’achat dans le navigateur.
- `drizzle/` contient les migrations SQL.

Sur l’hôte actuel, `node worker/build.mjs` assemble le Worker dans `dist/server/index.js`. Le manifeste d’hébergement est conservé dans le dépôt de déploiement Sites. Les secrets Stripe et Printful sont configurés sur le serveur.

## Préproduction

Le site est privé. L’indexation est désactivée par défaut. Le Worker fournit les URL canoniques, les variantes linguistiques, les métadonnées, le balisage Product et le plan du site. Le réglage serveur `TSU_INDEXABLE=true` est destiné au lancement public. Il ne change pas les permissions d’accès de l’hébergeur.

L’achat direct et le panier utilisent le même récapitulatif. Pour tester Stripe, fournir `STRIPE_TEST_KEY` et renseigner les frais et le délai du pays dans l’administration. Aucun paiement réel n’est activé. Les frais configurés ici sont ceux facturés au client à titre de test. Ils ne constituent pas un devis Printful.

## Points à finaliser avant la vente

- Renseigner l’identité du vendeur, les moyens de contact, les conditions de vente, la confidentialité, la procédure de retour et les informations produit, dont la composition et la sécurité selon les articles.
- Valider les taxes et les prix affichés. Confirmer les tarifs, les délais et les méthodes réellement disponibles avec les produits et adresses cibles. Examiner l’obligation belge de proposer deux méthodes de livraison et ses exceptions.
- Mettre en place la rétractation en ligne et son accusé de réception sur support durable selon le marché.
- Tester en réel dans un environnement prévu à cet effet le paiement Stripe, ses événements signés, la confirmation de commande, la réconciliation, les remboursements et l’exécution Printful.
- Vérifier les réponses sur le domaine définitif, le plan du site, l’accès aux robots de recherche et les données structurées d’offre après l’ouverture des ventes.
