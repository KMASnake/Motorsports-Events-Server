# ADR-0020 — TheSportsDB v1 et clé gratuite dans le chemin

Statut : accepté par le mainteneur
Date : 2026-08-15

## Contexte

TheSportsDB v1 impose sa clé API dans un segment du chemin. Le mainteneur veut
conserver cette version et accepte explicitement l’apparition de cette clé
gratuite dans l’appel réseau.

## Décision

L’adaptateur TheSportsDB utilise exclusivement la base fixe HTTPS
`https://www.thesportsdb.com/api/v1/json` et place la clé encodée dans le seul
segment prévu par le fournisseur. Cette exception est limitée à TheSportsDB v1.

La clé et l’URL complète ne doivent jamais apparaître dans les logs, erreurs,
exceptions, traces, audits, données source persistées, réponses API ou UI.
Les credentials en query string, les URL `user:password@host`, les hôtes libres,
les redirections, réponses non bornées et tout élargissement à un autre
fournisseur restent interdits.

## Conséquences

- découverte : `/{api_key}/all_leagues.php` ;
- acquisition : `/{api_key}/eventsseason.php?id={league}&s={season}` ;
- `providerHttp.ts`, l’allowlist, HTTPS, timeout, quota gate et streaming borné
  restent obligatoires ;
- les tests emploient uniquement des clés canaris factices et vérifient leur
  absence de toutes les surfaces observables hors URL passée au transport.
