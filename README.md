# TSŪ

## Organisation du code

- `worker/storefront.mjs` rend l’accueil, les collections, les fiches et les pages d’information en HTML côté serveur.
- `worker/editorial.mjs` contient l’histoire de la marque, la FAQ bilingue, le journal et les dates de parution vérifiées.
- `worker/shop-profile.mjs` valide et enregistre les coordonnées publiques et les réglages de livraison.
- `worker/checkout.mjs` crée les sessions Stripe, vérifie les paiements et synchronise les commandes avec Printful.
- `worker/stripe.mjs` vérifie et chiffre la clé Stripe du propriétaire.
- `worker/stripe-webhook.mjs` vérifie la signature des notifications Stripe et les associe aux commandes TSŪ.
- `worker/printful.mjs` gère la connexion Printful et l’import des produits en brouillon.
- `worker/account.mjs` gère le compte propriétaire.
- `worker/customer.mjs`, `worker/support.mjs` et `worker/newsletter.mjs` gèrent les comptes clients, le suivi, les tickets et les annonces aux abonnés.
- `worker/delivery.mjs` demande les dates estimées à Printful selon les variantes et le code postal.
- `dist/shop.js` et `dist/cart.js` gèrent le panier et le parcours d’achat dans le navigateur.
- `drizzle/` contient les migrations SQL.

Sur l’hôte actuel, `node worker/build.mjs` assemble le Worker dans `dist/server/index.js`. Le manifeste d’hébergement est conservé dans le dépôt de déploiement Sites. Les secrets Stripe et Printful sont configurés sur le serveur.

## Préproduction

Le site est privé. L’indexation est désactivée par défaut. Le Worker fournit les URL canoniques, les variantes linguistiques, les métadonnées, le balisage Product et le plan du site. Le réglage serveur `TSU_INDEXABLE=true` est destiné au lancement public. Il ne change pas les permissions d’accès de l’hébergeur.

L’achat direct et le panier utilisent le même récapitulatif. Pour tester Stripe, enregistrer une clé restreinte `rk_test_` depuis Commandes et tests et renseigner les frais et le délai du pays dans l’administration. La clé est chiffrée avec le secret serveur `TSU_STRIPE_ENCRYPTION_KEY`. Un réglage d’hébergement `STRIPE_TEST_KEY` est également accepté en l’absence de connexion administrateur. Les frais affichés pendant les tests sont provisoires.

La page de retour vérifie la session Stripe et affiche la référence TSŪ, le statut et le total confirmé. Un paiement confirmé déclenche la création d’un brouillon Printful. L’administration permet de relancer cette étape en cas d’erreur. La fabrication se valide dans Printful.

## Espace client et newsletter

`/espace-client` et `/en/account` sont les pages clients. L’espace propriétaire reste à `/compte`. Une commande est liée au compte client connecté au moment du paiement. Dans **Clients et newsletter**, le propriétaire répond aux tickets, consulte les inscriptions confirmées et envoie les annonces.

Utiliser un expéditeur vérifié dans Resend. Renseigner `RESEND_API_KEY` dans les secrets de l’hébergeur et `TSU_EMAIL_FROM` dans sa configuration. Les abonnés doivent confirmer leur adresse avant de recevoir une annonce. L’inscription donne accès aux designs « Abonnés uniquement » et aux avant-premières. Un design en avant-première devient public à l’heure de Bruxelles choisie dans sa fiche. La préproduction permet de simuler cet accès avant la configuration e-mail. Les annonces partent uniquement depuis l’administration.

## Configuration du mode réel

Une fois les tarifs de livraison et Stripe Tax validés, enregistrer la clé restreinte réelle `STRIPE_LIVE_KEY` et le secret de signature `STRIPE_LIVE_WEBHOOK_SECRET` dans les secrets de l’hébergeur. La destination Stripe réelle est `POST /api/stripe/webhook/live`. La destination de test `POST /api/stripe/webhook` utilise `STRIPE_TEST_WEBHOOK_SECRET`. L’hôte doit laisser Stripe atteindre chaque destination. Vérifier la livraison d’une notification depuis Stripe avant l’ouverture des ventes.

Abonner la destination à `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` et `checkout.session.expired`. Les deux modes utilisent des secrets distincts. Les événements réessayés et la page de retour utilisent le même identifiant externe Printful.

`TSU_CHECKOUT_MODE=live` sélectionne l’encaissement réel. Ce mode exige une connexion Printful, un secret de signature Stripe et des tarifs définitifs pour les pays actifs. Stripe Tax est demandé avec des prix taxes comprises en mode réel. Avant de l’activer, confirmer les immatriculations, les codes fiscaux et le résultat du calcul pour les pays livrés dans Stripe. Sur un domaine qui exige une connexion visiteur, le retour de paiement reste utilisable par un visiteur connecté. La livraison des notifications Stripe dépend de l’accès à la destination depuis l’extérieur.

## Points à finaliser avant la vente

- Renseigner l’identité du vendeur, les moyens de contact, les conditions de vente, la confidentialité, la procédure de retour et les informations produit, dont la composition et la sécurité selon les articles.
- Valider les taxes et les prix affichés. Confirmer les tarifs, les délais et les méthodes réellement disponibles avec les produits et adresses cibles. Examiner l’obligation belge de proposer deux méthodes de livraison et ses exceptions.
- Mettre en place la rétractation en ligne et son accusé de réception sur support durable selon le marché.
- Tester en réel dans un environnement prévu à cet effet le paiement Stripe, ses événements signés, la confirmation de commande, la réconciliation, les remboursements et l’exécution Printful.
- Vérifier les réponses sur le domaine définitif, le plan du site, l’accès aux robots de recherche et les données structurées d’offre après l’ouverture des ventes.
