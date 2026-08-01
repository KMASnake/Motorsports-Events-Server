# Idempotence

## Clé logique
Un run possède une clé composée au minimum de :
- providerId ;
- scope ;
- seasonId ou période ;
- request fingerprint ;
- idempotency key éventuelle.

## Observation
Une observation identique est reconnue par :
- fournisseur ;
- type externe ;
- identifiant externe ;
- empreinte du payload.

## Effet attendu
Relancer une synchronisation à données source identiques ne crée ni doublon,
ni nouvelle valeur canonique inutile, ni nouveau conflit identique non justifié.
