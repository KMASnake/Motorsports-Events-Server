# ADR 0011 — Rotation des journaux Docker

## Statut

Accepté.

## Décision

Tous les services du déploiement principal utilisent le pilote Docker
`json-file` avec une taille maximale de 10 Mio par fichier, cinq fichiers
conservés et la compression des fichiers tournés.

La configuration est définie une seule fois par une ancre Compose puis
appliquée à PostgreSQL, l’API, le scheduler, les migrations et Caddy. Une mise
à niveau recrée les conteneurs et applique donc la politique sans modifier la
configuration globale du démon Docker.

## Conséquences

- chaque conteneur utilise au plus environ 50 Mio avant compression ;
- `docker compose logs` reste disponible pour l’exploitation ;
- les anciens fichiers sont supprimés automatiquement par Docker ;
- la rotation ne remplace pas une future collecte centralisée ;
- le contrat API et le schéma PostgreSQL restent inchangés.
