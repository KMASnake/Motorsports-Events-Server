# ADR 0007 — Tests PostgreSQL isolés

## Statut

Accepté pour le sous-jalon 4.3 du Jalon 4.

## Contexte

Les tests SQLite valident les règles générales, mais ne reproduisent pas les
types JSON, transactions et comportements de PostgreSQL en production. Les
tests ne doivent jamais utiliser la base du développeur ou du VPS.

## Décision

- Les tests PostgreSQL utilisent `docker-compose.test.yml`.
- PostgreSQL 16 stocke ses données dans un `tmpfs`.
- Le conteneur de tests ne reçoit que des identifiants factices.
- Chaque test crée une base au nom aléatoire puis la supprime.
- Les événements utilisés proviennent de fixtures versionnées.
- Le script `scripts/test-postgres.sh` supprime conteneurs, réseau et volumes
  même lorsqu’un test échoue.
- GitHub Actions exécute ces tests dans un job indépendant.

## Conséquences

Les migrations et la persistance PostgreSQL deviennent reproductibles sans
réseau provider et sans données de production. Le temps de CI augmente à cause
de la construction du conteneur de tests.
