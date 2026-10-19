# ADR-0019 — Autorisation d'implémentation du Lot 5.6

Date : 2026-08-14
Statut : **ACCEPTÉ**

## Contexte

Le Lot 5.6 — Acquisition fournisseur durable a été conçu, doté d'un contrat UI et d'une Acceptance consolidée, audité contre les invariants 5.4/5.5, la baseline de sécurité HTTP et la frontière 5.7, puis corrigé et revu post-corrections.

Le mainteneur a explicitement déclaré le 2026-08-14 : **« Je valide et j'autorise l'implémentation du lot 5.6 »**.

## Décision

L'implémentation du **seul Lot 5.6** est autorisée.

- `authorized_sub_lot = 5.6` ;
- le Concept 5.6, le contrat UI 5.6 et l'Acceptance 5.6 sont les spécifications normatives d'implémentation ;
- les corrections d'audit C1–C4 et les 47 scénarios d'Acceptance sont obligatoires ;
- 5.4 reste souverain pour scheduler, leases, fencing et fairness ;
- 5.5 reste souverain pour quotas, cadence, réserve current, backoffs et comptage ;
- la baseline sécurité ADR-0016 reste obligatoire ;
- le modèle métier Event-as-Session de l'ADR-0013 n'est pas modifié ;
- les Lots **5.7 et suivants restent non autorisés à l'implémentation**.

## Portée de l'autorisation

Cette décision autorise le développement, les migrations, tests, données de recette et surfaces ACP strictement nécessaires au Lot 5.6.

Elle ne constitue :

- ni une validation finale de l'implémentation 5.6 ;
- ni une autorisation de fusion dans `main` ;
- ni une autorisation d'anticiper 5.7+.

L'implémentation devra être auditée et validée explicitement par le mainteneur avant clôture du Lot 5.6.

## Résolution des anciens gates documentaires

Les mentions antérieures « implémentation non autorisée », « gate non passé », « autorisation non accordée » ou équivalentes présentes dans les documents de conception/audit 5.6 décrivaient l'état **avant** cette décision et sont désormais historiques.

À compter de cette décision, elles ne peuvent plus être interprétées comme une interdiction actuelle du Lot 5.6. Elles restent applicables uniquement à l'état documentaire antérieur à l'autorisation.

Toute formulation encore ambiguë doit être lue conformément au présent ADR, au Handbook, à `PROJECT-STATUS.json` et à `docs/handoff/PROGRESS.json`.

## Gate courant

- Lot 5.5 : validé ;
- Lot 5.6 : **AUTORISÉ À L'IMPLÉMENTATION** ;
- Lot 5.7+ : **NON AUTORISÉS À L'IMPLÉMENTATION**.
