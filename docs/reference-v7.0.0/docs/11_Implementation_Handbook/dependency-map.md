# Cartographie des dépendances

- `domain` ne dépend d'aucune infrastructure.
- `application` dépend de `domain`.
- `persistence` implémente les ports de `application`.
- `public-api` et `admin-api` appellent `application`.
- `provider-adapters` implémentent les contrats du moteur de synchronisation.
- `synchronization-engine` dépend de ports, pas des fournisseurs concrets.
- `correction-engine` dépend du domaine, de l'audit et des politiques.
- `deployment` assemble les implémentations.
- `tests-e2e` dépend de l'application déployée, jamais l'inverse.
