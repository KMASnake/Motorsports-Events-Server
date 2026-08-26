# Lot 5.6 — Autorisation mainteneur d'implémentation

Date : 2026-08-14
Statut : **AUTORISÉ À L'IMPLÉMENTATION**

## Décision explicite

Le mainteneur a déclaré :

> Je valide et j'autorise l'implémentation du lot 5.6

Cette décision intervient après :

- formalisation du Concept 5.6 ;
- validation du contrat UI 5.6 ;
- formalisation puis consolidation de l'Acceptance 5.6 ;
- audit croisé 5.6 ↔ 5.4 ↔ 5.5 ↔ sécurité ↔ frontière 5.7 ;
- fermeture des constats C1–C4 ;
- revue post-corrections PASS ;
- consolidation des critères et de la matrice des 47 scénarios.

## Gate courant

- `authorized_sub_lot = 5.6` ;
- Lot 5.6 : **AUTORISÉ À L'IMPLÉMENTATION** ;
- Lot 5.6 : **NON ENCORE VALIDÉ FINALEMENT** ;
- fusion dans `main` : **NON AUTORISÉE PAR CETTE DÉCISION** ;
- Lots 5.7 et suivants : **NON AUTORISÉS À L'IMPLÉMENTATION**.

## Sources de vérité

Cette autorisation est consignée dans :

- `PROJECT-HANDBOOK.md` ;
- `PROJECT-STATUS.json` ;
- `docs/handoff/PROGRESS.json` ;
- `docs/handbook/DECISIONS.md` ;
- `docs/handbook/CHANGELOG.md` version 1.32 ;
- `docs/handbook/architecture/ADR-0019-LOT-5.6-ACQUISITION-AUTHORIZATION.md` ;
- les gates courants du Concept, du contrat UI et de l'Acceptance 5.6.

Les documents d'audit/consolidation ont également été annotés pour distinguer leur ancien état historique du gate actuel.

## Limites

L'autorisation ne permet pas :

- d'implémenter 5.7+ ;
- de modifier arbitrairement 5.4 ou 5.5 ;
- de contourner les quotas, leases ou fencing ;
- de réintroduire un modèle métier Event→Sessions ;
- de fusionner dans `main` ;
- de déclarer le Lot 5.6 validé avant preuves, audit et validation mainteneur explicite.
