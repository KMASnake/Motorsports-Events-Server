# Session

## Rôle
Représente une activité sportive planifiée.

## Identité
Identifiant interne ; clé de rapprochement calculée.

## Attributs essentiels
- Type
- Nom affiché
- Début
- Fin
- Fuseau
- Statut

## Relations
- Appartient à une épreuve
- Possède des observations fournisseurs

## Cycle de vie
Provisoire → Confirmée → En cours → Terminée / Annulée

## Invariants
- Fin >= début
- Type normalisé
- Une qualification sprint n'est pas une course sprint

## Événements de domaine
- SessionScheduled
- SessionUpdated
- SessionCancelled
