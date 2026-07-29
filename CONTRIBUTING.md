# Contribuer au serveur

## Branches

- `main` : versions validées ;
- `develop` : intégration ;
- `feature/*` : fonctionnalités ;
- `fix/*` : corrections ;
- `release/*` : préparation de version.

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
