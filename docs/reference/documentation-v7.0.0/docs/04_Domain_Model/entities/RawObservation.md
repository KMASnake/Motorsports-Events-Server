# RawObservation

## Rôle
Conserve une donnée brute reçue d'un fournisseur.

## Identité
Fournisseur + identifiant externe + version/empreinte.

## Attributs essentiels
- Payload
- Empreinte
- Date de collecte
- Identifiant externe

## Relations
- Liée à une synchronisation
- Peut être rapprochée d'un objet canonique

## Cycle de vie
Collectée → Validée → Rapprochée / Rejetée

## Invariants
- Le payload original n'est pas modifié

## Événements de domaine
- ObservationCollected
- ObservationRejected
