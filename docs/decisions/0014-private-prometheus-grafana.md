# ADR 0014 — Supervision Prometheus/Grafana privée

## Statut

Accepté.

## Décision

Prometheus et Grafana sont optionnels et déployés par un fichier Compose
additionnel. Prometheus n’expose aucun port hôte. Grafana écoute exclusivement
sur `127.0.0.1:3000` et se consulte par tunnel SSH.

Le mot de passe administrateur est obligatoire, les inscriptions sont
désactivées et le tableau de bord ne contient que les métriques techniques
publiées par l’API.

## Conséquences

- aucune interface de supervision n’est accessible directement sur Internet ;
- les données Prometheus sont conservées 30 jours ;
- le déploiement normal reste inchangé si la supervision n’est pas démarrée ;
- l’administrateur doit créer un tunnel SSH pour utiliser Grafana.
