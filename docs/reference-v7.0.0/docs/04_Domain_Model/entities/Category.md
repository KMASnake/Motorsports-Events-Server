# Category — Catégorie

## Rôle
Subdivision facultative d'un championnat : Moto2 dans MotoGP, Hypercar dans WEC.

## Attributs
`id`, `championshipId`, `code`, `name`, `shortName`, `displayOrder`, `status`.

## Relations
Appartient à un championnat et peut posséder plusieurs saisons.

## Invariants
- unicité du code dans le championnat ;
- aucune catégorie n'est créée automatiquement ;
- ne peut être utilisée par une saison d'un autre championnat.
