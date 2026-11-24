# Migration de TSŪ vers Vercel et Supabase

La boutique fonctionne sur Sites avec une base SQLite/D1. Supabase assure déjà la veille du Journal. La migration concerne le serveur de la boutique, les comptes et leurs données. La consigne actuelle est de conserver l’accès privé.

## 1. Inventaire et sauvegarde

- Consigner le commit et la version Sites réellement déployés, la configuration de visibilité, les migrations appliquées et les noms des variables serveur. Identifier les secrets encore actifs chez Stripe, Printful et le service e-mail. Les tenir hors du dépôt et des journaux.
- Exporter la base complète via la fonction d’export du propriétaire de D1. Avec un accès Cloudflare autorisé, utiliser `wrangler d1 export <base> --remote --output=<sauvegarde.sql>`. Avec une liaison D1 gérée par Sites, vérifier l’accès réel à un export ou demander l’export au gestionnaire de l’hébergement. Une archive du code seule ne contient pas les clients ni les commandes.
- Chiffrer la sauvegarde au repos et restaurer l’export dans une base SQLite isolée. Consigner le résultat de `PRAGMA integrity_check`, de `PRAGMA foreign_key_check`, les volumes par table et la somme par devise et statut des paiements. Sauvegarder séparément le schéma et les tables de veille Supabase et la définition des tâches planifiées. Faire la recette avec des données fictives ou anonymisées.

## 2. Porter les données et le serveur

| Élément du code | Travail côté Vercel/PostgreSQL | Vérification |
|---|---|---|
| Worker et liaison `env.DB` | Fournir un gestionnaire HTTP serveur Vercel et un accès PostgreSQL privé. Préserver les routes et les réponses JSON consommées par les pages actuelles. | Accueil, compte, API, RSS et assets gardent leurs chemins et types MIME. |
| `prepare().bind().first()/all()/run()` et `DB.batch()` | Porter les paramètres SQLite vers les requêtes PostgreSQL. Conserver les mises à jour conditionnelles, les décomptes de lignes et l’atomicité des lots dans une seule transaction. | Échec au milieu d’une opération, relances et concurrence aboutissent à un seul résultat cohérent. |
| `rowid`, `AUTOINCREMENT`, JSON et temps | Introduire un ordre de catalogue explicite, convertir les identifiants séquentiels et leurs séquences, porter `json_extract`, `json_set` et la sémantique de suppression de `json_patch` vers JSONB. Convertir les dates UTC et les epochs en conservant les unités de chaque colonne. | Comparer IDs, variantes, ordres d’affichage, dates, totaux et relations avant/après. |
| Clients, sessions, abonnements et tickets | Conserver les identifiants client et références d’achats, les preuves de consentement, les demandes de rétractation et leurs confirmations. Décider explicitement du chemin de reconnexion de l’existant. | Deux clients restent isolés. Une réinitialisation et la désinscription fonctionnent. Un ticket conserve ses messages et son propriétaire. |
| Secrets et données chiffrées | Conserver les clés de déchiffrement pour la migration ou reconnecter les fournisseurs avec des clés neuves. Conserver le pepper uniquement tant que l’ancien format de mots de passe est utilisé. | Reconnexion réelle en test avec compte déjà créé et chargement correct des paramètres chiffrés. |
| Veille Supabase | Garder les instantanés hebdomadaires, les URLs publiques, le lecteur serveur et un seul planificateur actif. Limiter les rôles et appliquer la sécurité RLS aux tables marchandes créées. | Une édition archivée et le dernier numéro restent accessibles via les mêmes liens et le RSS. |

## 3. Remplacer l’identité de l’hébergeur

Le serveur actuel reçoit `oai-authenticated-user-id` et `oai-authenticated-user-email` de la passerelle Sites. Sur Vercel, retirer ces en-têtes dès l’entrée, y compris pour les pages d’administration, le MCP et le retour de paiement. Obtenir l’identité propriétaire depuis une session Supabase Auth vérifiée côté serveur, puis comparer l’identifiant utilisateur immuable avec le propriétaire configuré. Faire échouer l’accès si cette configuration manque. L’adresse e-mail seule ne suffit pas.

Le contrôle de build de ce dépôt refuse le lancement Vercel sans adaptateur. Le build Worker refuse également l’environnement Vercel déclaré. Lors du portage, remplacer le contrôle de préparation par le build de l’adaptateur authentifié et ses tests de permissions. Le contrôle de build n’authentifie aucune requête.

## 4. Préproduction privée et recette

1. Protéger tout le domaine de préproduction, avec l’indexation et les encaissements réels désactivés. Configurer les adresses de retour et les liens e-mail pour le domaine de test.
2. Tester un visiteur, deux clients et le propriétaire. Vérifier le refus des pages et API privées sans session vérifiée, même si des en-têtes d’identité sont présents.
3. Paramétrer une destination de webhook Stripe **de test** avec son propre secret. Vérifier le corps HTTP brut, la signature, le montant, la devise, Stripe Tax et la réception lorsque l’acheteur ferme son navigateur. Vérifier que le tunnel de protection ne bloque pas Stripe. Les actions de test Printful produisent seulement un brouillon.
4. Tester panier et achat direct BE/FR, estimation de livraison, compte oublié, e-mails, retraits de consentement, suivi, rétractation, archivage et diagnostics d’administration. Comparer les routes, canoniques et flux au domaine cible prévu. Rejouer la suite sur le code exact destiné à la bascule.

## 5. Bascule et retour arrière

- Avant le transfert final, placer les écritures marchandes en maintenance et conserver les événements Stripe à réconcilier. Suspendre les tâches dont les deux hébergeurs pourraient dupliquer les effets. Refaire un export final, transférer le delta et rapprocher les numéros de commandes, références Stripe/Printful et accusés de réception.
- Pointer le domaine et les callbacks vers la cible après vérification. Séparer le changement d’hébergement de l’autorisation d’ouverture au public. Confirmer les e-mails, la planification et le mode de fabrication sur le domaine cible.
- Si un contrôle échoue avant toute nouvelle écriture, rétablir le domaine, les callbacks et les tâches précédents. S’il y a eu des écritures sur Vercel, suspendre les deux côtés, réconcilier le delta et les événements avant le retour vers Sites. Vérifier chaque commande en attente afin d’éviter une seconde facturation ou fabrication.
- Conserver l’ancien déploiement et les sauvegardes pendant la fenêtre de validation. Réactiver ensuite un seul planificateur par tâche et documenter la dernière commande vérifiée.

Références : [export D1](https://developers.cloudflare.com/d1/best-practices/import-export-data/), [authentification Supabase côté serveur](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [commande de build Vercel](https://vercel.com/docs/project-configuration/vercel-json), [variables système Vercel](https://vercel.com/docs/environment-variables/system-environment-variables).
