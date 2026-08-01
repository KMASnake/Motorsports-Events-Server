# Cycle de vie d'une correction

## Statuts
- draft
- submitted
- under_review
- approved
- active
- rejected
- revoked
- expired

## Transitions autorisées
- draft → submitted
- submitted → under_review
- under_review → approved
- under_review → rejected
- approved → active
- active → revoked
- active → expired

## Règles
- Une correction rejetée n'est jamais active.
- Une correction active possède un override.
- Une correction révoquée conserve tout son historique.
- Une correction ne revient jamais à l'état draft après soumission.
