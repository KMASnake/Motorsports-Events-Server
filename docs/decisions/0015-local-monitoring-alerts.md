# ADR 0015 — Alertes locales de supervision

## Statut

Accepté.

## Décision

Prometheus évalue des règles locales pour détecter :

- l’impossibilité de collecter l’API pendant deux minutes ;
- un taux de réponses HTTP 5xx supérieur à 5 % pendant cinq minutes, avec un
  trafic minimal pour éviter les ratios non significatifs ;
- plusieurs redémarrages de l’API sur une fenêtre de trente minutes.

Grafana affiche le nombre d’alertes actives. Aucun Alertmanager, webhook,
courriel ou service public supplémentaire n’est introduit tant qu’un canal de
notification n’a pas été explicitement choisi.

## Conséquences

- les alertes sont visibles par le tunnel SSH Grafana existant ;
- les pannes brèves ne provoquent pas d’alerte immédiate ;
- aucune adresse, clé ou destination de notification n’est stockée ;
- l’ajout futur de notifications nécessitera une configuration séparée et
  protégée.
