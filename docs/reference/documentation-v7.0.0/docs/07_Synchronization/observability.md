# Observabilité

## Journaux
- runId
- providerId
- correlationId
- étape
- durée
- résultat
- erreur normalisée

## Métriques
- runs par statut ;
- durée par étape ;
- requêtes fournisseur ;
- taux de 429 ;
- observations reçues/rejetées ;
- changements canoniques ;
- conflits ouverts ;
- retries ;
- âge de la dernière synchronisation réussie.

## Traces
Propager le correlationId entre scheduler, workers, base et API.
