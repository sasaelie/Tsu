# Import de produits Printful

Chaque passage sur `/api/jobs/printful-catalog` lit une page de huit références et crée les nouveaux produits en brouillon. Le curseur et la date du passage sont enregistrés en base. L’administration les affiche dans **Produits**. Une fiche approuvée ou modifiée conserve ses réglages. La fin d’un catalogue remet le curseur au début pour découvrir les nouveautés et reprendre les fiches que Printful n’a pas renvoyées. Si la messagerie est configurée, chaque passage reprend aussi jusqu’à deux accusés de rétractation en attente.

Pour parcourir toutes les pages en une exécution, le processus de planification peut lancer `node scripts/sync-printful.mjs` avec Node 20 ou ultérieur. Il utilise les variables privées suivantes.

- `TSU_SITE_ORIGIN` contient l’origine HTTPS exacte de la boutique.
- `TSU_CATALOG_CRON_SECRET` contient un secret aléatoire dédié d’au moins 32 caractères, configuré également sur le serveur de la boutique.
- Sur Sites privé, le processus doit disposer d’un accès de service valide à ce site. `TSU_SITES_SERVICE_TOKEN` est facultatif pour les hébergeurs indépendants et reste limité par le script à l’hôte Sites d’origine. Un cookie de visiteur ne convient pas à une tâche récurrente.

Après la migration vers un domaine Vercel accessible aux machines, Supabase Cron peut également appeler directement une page toutes les quinze minutes. Pour ce mode, placer le domaine dans Vault sous `tsu_catalog_origin`, le secret dédié sous `tsu_catalog_runner`, vérifier une exécution authentifiée, puis appliquer `supabase/jobs/catalogue.sql`. La planification utilise `pg_cron`, `pg_net` et Vault du projet. Prévoir un seul planificateur principal. La boutique peut garder sa visibilité privée tant qu’une méthode d’accès machine est vérifiée. La présence du code ou du secret ne confirme pas un passage programmé. Le premier passage se vérifie dans l’admin.
