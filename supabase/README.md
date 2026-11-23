# Veille du Journal TSŪ

Supabase Cron lance chaque dimanche la fonction Edge `tsu-watch`. Elle collecte les sorties de la semaine suivante et crée un brouillon privé par lundi. Les rapports de collecte restent dans `tsu_watch_runs`. Les liens et dates sont conservés pour la relecture. TVmaze indique les diffusions japonaises. La disponibilité en Belgique reste à vérifier.

## Installer dans un autre projet Supabase

1. Appliquer la migration du dossier `migrations`.
2. Créer dans Vault deux secrets aléatoires distincts de 32 octets encodés en hexadécimal, `tsu_watch_runner` pour lancer la veille et `tsu_watch_reader` pour lire les brouillons. Les valeurs restent dans Vault et dans les variables d’environnement privées qui en ont besoin.
3. Déployer la fonction `tsu-watch` avec `deno.json` et `verify_jwt = false`. La fonction valide sa propre clé avec la procédure SQL à accès restreint.
4. Planifier la requête ci-dessous avec le domaine du projet. Les deux passages UTC couvrent les changements d’heure. La fonction exécute la collecte uniquement à 18 h à Bruxelles.

```sql
select cron.schedule('tsu_watch_weekly','0 16,17 * * 0',$job$
  select net.http_post(
    url := 'https://PROJECT_REF.supabase.co/functions/v1/tsu-watch',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-tsu-watch-token',
      (select decrypted_secret from vault.decrypted_secrets where name='tsu_watch_runner')
    ),
    body := '{"scheduled":true}'::jsonb,
    timeout_milliseconds := 60000
  );
$job$);
```

Pour tester une semaine, remplacer le corps par `{"week":"2026-11-30"}` et exécuter la requête HTTP SQL une fois. La réponse se trouve dans `net._http_response`. Un brouillon partiel reste disponible si une source échoue. Une collecte vide ne remplace pas un brouillon existant.

## Relier l’administration TSŪ

- `TSU_WATCH_URL` reçoit l’URL de la fonction.
- `TSU_WATCH_READ_TOKEN` reçoit la valeur privée de `tsu_watch_reader` côté serveur.
- `TSU_AI_ENCRYPTION_KEY` reçoit une clé AES-GCM aléatoire de 32 octets encodés en hexadécimal. Conserver cette valeur lors d’un redéploiement qui conserve les données existantes.
- Le propriétaire fournit la clé DeepSeek dans **Administration → Journal**. Le serveur la vérifie sur l’API, puis enregistre la clé chiffrée. Les propositions passent par le brouillon et une publication manuelle.

Pour un hébergement Vercel, garder le même projet Supabase et reprendre les variables côté serveur. La planification de la veille reste sur Supabase. Le site actuel utilise encore SQLite/D1 pour ses comptes, son catalogue et ses articles. Porter ces données et la connexion administrateur fait partie de la migration de la boutique.
