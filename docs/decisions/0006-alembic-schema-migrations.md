# ADR 0006 — Migrations de schéma avec Alembic

## Statut

Accepté pour le premier sous-jalon d’infrastructure du Jalon 4.

## Contexte

Jusqu’à la 2.6.0, l’API et le scheduler appellent `create_all()` au démarrage
et l’application exécute plusieurs instructions SQL ad hoc. Ce fonctionnement
ne fournit ni historique ordonné, ni révision de schéma vérifiable.

Le VPS contient déjà une base PostgreSQL en production. Son adoption ne doit
ni supprimer les données, ni rejouer la création des tables.

## Décision

- Alembic est l’unique mécanisme de migration à partir de ce jalon.
- Les migrations sont exécutées par un service Docker `migrate`.
- L’API et le scheduler attendent la réussite de ce service.
- Une base vierge reçoit toutes les migrations jusqu’à `head`.
- Une base existante sans table `alembic_version` est contrôlée : les tables
  et colonnes attendues doivent être présentes avant de la marquer à la
  révision initiale.
- L’API et le scheduler refusent de démarrer si la révision de la base ne
  correspond pas à la révision Alembic attendue.
- Les scripts de sauvegarde et de rollback existants restent obligatoires
  avant toute mise à niveau.

## Conséquences

Chaque changement de schéma devra être livré dans une nouvelle révision
Alembic. Une base ancienne ou inconnue échouera explicitement au lieu d’être
modifiée silencieusement au démarrage de l’API.
