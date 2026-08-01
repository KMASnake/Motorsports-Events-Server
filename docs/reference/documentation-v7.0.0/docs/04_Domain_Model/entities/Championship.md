# Championship — Championnat

## Rôle
Représente une compétition stable, par exemple Formule 1, MotoGP ou WorldSBK.

## Attributs
`id`, `disciplineId`, `code`, `officialName`, `shortName`, `description`, `logo`, `status`.

## Relations
- appartient à une discipline ;
- possède zéro à plusieurs catégories ;
- possède plusieurs saisons, directement ou via une catégorie ;
- peut être associé à plusieurs fournisseurs.

## Invariants
Code unique ; discipline obligatoire ; suppression physique interdite lorsqu'une saison existe.
