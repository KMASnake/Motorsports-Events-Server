# Overrides au niveau du champ

## Règle
Un override protège un seul champ d'une seule entité.

## Exemple
Une correction de `startsAt` n'empêche pas la mise à jour fournisseur de :
- `status`
- `displayName`
- `endsAt`
- `circuitId`

## Unicité
Un seul override actif par :
`(targetType, targetId, fieldName)`.

## Conflit
La tentative d'activer un second override concurrent retourne 409 ou déclenche
un remplacement explicite selon la permission utilisée.
