# Override

## Rôle
Effet actif d'une correction sur un champ canonique.

## Identité
Objet + champ + correction active.

## Attributs essentiels
- Valeur forcée
- Date d'effet
- Politique de réversion

## Relations
- Appartient à une correction

## Cycle de vie
Actif → Réversion proposée → Révoqué

## Invariants
- Un seul override actif par objet et champ

## Événements de domaine
- OverrideActivated
- ReversionProposed
- OverrideReverted
