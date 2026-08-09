# ADR-0009 — Migrations PostgreSQL versionnées

## Décision

Toute évolution du schéma ou transformation de données est réalisée par une
migration SQL versionnée, exécutée avant le démarrage de l'API et enregistrée
dans `schema_migrations`.

Le démarrage de l'API est strictement en lecture seule vis-à-vis du schéma et
des données métier. Il vérifie la présence des migrations requises et refuse
de démarrer si le schéma est incomplet.

## Réversibilité

Chaque transformation de données fournit un rollback. Lorsqu'une donnée ne
peut plus rester active dans le nouveau modèle, elle est archivée avec toutes
ses colonnes afin d'être restaurable. Un rollback destructif refuse de
s'exécuter tant que des données subsistent.

## Déploiement

Docker exécute un service `migrate` à usage unique après la santé PostgreSQL et
avant l'API. Réexécuter la migration ou redémarrer l'API ne modifie aucune
donnée déjà migrée.

## Validation

Chaque évolution couvre au minimum : base vierge, base existante, seconde
exécution, démarrages API successifs, rollback et réapplication.
