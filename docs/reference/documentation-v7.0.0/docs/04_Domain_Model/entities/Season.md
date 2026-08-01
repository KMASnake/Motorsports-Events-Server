# Season — Saison

## Rôle
Édition datée d'un championnat, éventuellement limitée à une catégorie.

## Attributs
`id`, `championshipId`, `categoryId?`, `label`, `year?`, `startsOn?`, `endsOn?`, `status`.

## Relations
- appartient toujours à un championnat ;
- appartient facultativement à une catégorie du même championnat ;
- contient des épreuves.

## Invariants
- `championshipId` obligatoire ;
- `categoryId` nullable ;
- cohérence catégorie/championnat ;
- date de fin postérieure ou égale à la date de début ;
- unicité championnat + catégorie nullable + libellé.
