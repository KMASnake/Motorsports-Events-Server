# Scénarios d'échec

## Fournisseur indisponible
Marquer le run en retry_wait puis failed si la limite est atteinte.

## Réponse partielle
Conserver les pages valides, marquer partially_completed et ne pas conclure à
la suppression des éléments absents.

## Changement de schéma
Mettre en quarantaine les observations invalides et ouvrir une alerte.

## Quota épuisé
Respecter le délai fournisseur et reprendre sans dupliquer.

## Crash worker
Le verrou expire et un autre worker reprend depuis le dernier checkpoint.

## Base indisponible
Ne pas considérer une page comme confirmée tant que sa transaction n'est pas
validée.
