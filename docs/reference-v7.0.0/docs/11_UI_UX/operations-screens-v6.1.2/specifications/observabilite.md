# Écran Observabilité

## Objectif
Présenter la santé technique du serveur, des workers, de la base et des synchronisations.

## Structure
- Sélecteur de période et actualisation automatique.
- KPI : disponibilité, latence p95, erreurs, backlog.
- Cartes de santé : API, base PostgreSQL, Redis/queue, scheduler, stockage.
- Graphes : débit, latence, erreurs, longueur de file.
- Incidents actifs et derniers déploiements.

## Règles
- Les métriques affichent l’horodatage de la dernière donnée.
- Une donnée ancienne passe en état `stale` au-delà de deux intervalles de collecte.
- Les seuils sont configurables et documentés.
- Corrélation possible vers Journaux avec période et service préremplis.

## États
Normal, avertissement, critique, métrique absente, données obsolètes, service inconnu, maintenance planifiée.
