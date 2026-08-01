# Modèle de correction

## Champs obligatoires
- targetType
- targetId
- fieldName
- oldValue
- newValue
- reason
- authorUserId
- createdAt
- status

## Champs de validation
- reviewerUserId
- reviewedAt
- reviewDecision
- reviewComment

## Champs d'effet
- activeFrom
- activeUntil
- reversionPolicy
- overrideId

## Invariant
La valeur corrigée doit être compatible avec le type du champ ciblé.
