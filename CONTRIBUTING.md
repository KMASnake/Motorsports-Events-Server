# Contribuer au serveur

## Branches

- `main` : versions ayant déjà reçu une validation utilisateur explicite ;
- `develop` : intégration ;
- `feature/*` : fonctionnalités ;
- `fix/*` : corrections ;
- `release/*` : préparation de version.

Une fusion, une CI verte, un build ou un déploiement ne constituent pas une
validation utilisateur. Celle-ci doit être consignée dans
`PROJECT-STATUS.json` et `docs/handoff/PROGRESS.json`.

## Avant une contribution

```bash
./scripts/validate-repository.sh
```

Les tests d’intégration PostgreSQL utilisent des conteneurs et des données
temporaires isolés :

```bash
./scripts/test-postgres.sh
```

Le script supprime automatiquement les conteneurs et volumes de test à la fin.

Les modifications de l’API doivent être documentées dans `docs/`.
