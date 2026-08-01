# Extensions API corrections

## Création
POST `/admin/corrections`

## Soumission
POST `/admin/corrections/{id}/submit`

## Revue
POST `/admin/corrections/{id}/review`

## Approbation
POST `/admin/corrections/{id}/approve`

## Rejet
POST `/admin/corrections/{id}/reject`

## Révocation
POST `/admin/corrections/{id}/revoke`

## Propositions de réversion
GET `/admin/reversion-proposals`
POST `/admin/reversion-proposals/{id}/approve`
POST `/admin/reversion-proposals/{id}/reject`

## Prévisualisation
POST `/admin/corrections/preview`
