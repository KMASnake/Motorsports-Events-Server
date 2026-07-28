# État du projet

Dernière mise à jour : 28 juillet 2026.

## Version retenue

- projet : `motorsports-events-server` ;
- version fonctionnelle : `2.5.2` ;
- jalon : `3-versioned-client-contracts` ;
- build : `20260728-210128` ;
- API publique : `/api/v1` ;
- dépôt GitHub : `KMASnake/Motorsports-Events-Server` (privé).

## Release validée

- archive : `motorsports-events-server-2.5.2.zip` ;
- SHA-256 :
  `0baf289ec16b05a38ff41e05de6f2bc94f547815e311751da04033d824bbd6df` ;
- tests locaux : 21 réussis ;
- archive réextraite et retestée : réussie ;
- intégrité ZIP : réussie.

## Validation VPS

La version 2.5.2 est validée sur le VPS :

- version locale et API : 2.5.2 ;
- API et PostgreSQL : `healthy` ;
- Caddy et scheduler : actifs ;
- `/api/v1/events` : HTTP 200 et JSON valide ;
- pagination différentielle : pages 1–5 puis 6–10, sans doublon ;
- synchronisation concurrente : HTTP 503 et `Retry-After: 10` ;
- curseur invalidé après synchronisation : HTTP 409 ;
- curseur invalide : HTTP 422 ;
- synchronisation manuelle : 0 créée, 243 mises à jour, 0 erreur ;
- aucun nouveau traceback ou `Internal Server Error`.

## État Git

- branche stable : `main` ;
- publication 2.5.2 : pull request GitHub `#1` ;
- branche de publication : `agent/publish-2.5.2-handoff` ;
- référence officielle de release : tag annoté `v2.5.2`.

## Problèmes connus

- une séance provider « Warmup » a été observée avec `end_at < start_at` ;
- cette anomalie de qualité des données ne bloque pas le contrat du Jalon 3 ;
- elle doit être reproduite, attribuée au provider ou à la normalisation, puis
  couverte par un test avant correction.

## Exploitation

Les commandes Docker nécessitent actuellement `sudo` sur le VPS :

```bash
sudo ./verify-installation.sh
sudo ./status.sh
```

La mise à niveau conserve `.env`, les données PostgreSQL, une sauvegarde
pré-mise à niveau et un dossier de rollback.
