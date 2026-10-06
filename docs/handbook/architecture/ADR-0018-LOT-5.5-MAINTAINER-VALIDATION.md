# ADR-0018 — Validation mainteneur du Lot 5.5 Quotas et cadence

Date : 2026-08-14
Statut : accepté par le mainteneur

## Contexte

Le Lot 5.5 — Quotas et cadence a été implémenté sous l'autorisation de l'ADR-0017 puis soumis à plusieurs audits mainteneur. Les constats successifs ont porté sur la prise en compte restrictive du `remaining` fournisseur, les observations multi-fenêtres, la propagation de `next_eligible_at`, la sélection des blockers sans échéance, le diagnostic administrateur générique et la robustesse du décompte lorsque plusieurs charges partagent le même timestamp.

Toutes les corrections demandées ont été appliquées puis ré-auditées. La recette PostgreSQL dédiée compte 61 cas réussis. Les non-régressions 5.4, les contrôles sécurité, les builds API/Web, Docker et Chromium/CSP sont documentés dans `docs/handoff/LOT-5.5-VALIDATION.md`.

La validation a été réalisée sans appel fournisseur réel et sans consommation de crédit fournisseur.

## Décision

Le mainteneur valide explicitement l'implémentation du **Lot 5.5 — Quotas et cadence** le 2026-08-14.

Sont notamment validés :

- quota gate PostgreSQL atomique et multi-instance avant émission ;
- fenêtres minute, heure, jour et mois et intervalle minimal ;
- modèle hybride observations fournisseur fiables + compteurs locaux conservateurs ;
- prise en compte restrictive du `remaining` fournisseur ;
- marge de sécurité et réserve protégée `current` ;
- budget partagé entre synchronisation, discovery et test de connexion ;
- pacing dynamique, backoffs provider/stream et `Retry-After` ;
- compensation uniquement sur non-émission prouvée ;
- absence de remboursement après émission ou rejet par fencing ;
- propagation et persistance cohérentes de `blocking_reason` et `next_eligible_at` ;
- observations quota multi-fenêtres normalisées sans secret ;
- décompte post-observation robuste aux timestamps identiques via séquence PostgreSQL monotone ;
- non-régression des invariants du scheduler 5.4 et de la baseline sécurité pré-5.5.

## Preuves

Document de validation : `docs/handoff/LOT-5.5-VALIDATION.md`.

Preuves principales :

- 61 cas PostgreSQL Lot 5.5 réussis ;
- tests Lot 5.4 réussis ;
- lint, typecheck, tests API/Web et builds réussis ;
- tests sécurité réussis ;
- validation Chromium/CSP réussie ;
- builds Docker API/Web réussis ;
- `validate-repository.sh` et `git diff --check` réussis ;
- audit npm sans vulnérabilité au seuil exécuté ;
- `REAL PROVIDER REQUESTS = 0` ;
- `PROVIDER CREDITS CONSUMED = 0`.

## Gouvernance et suite

`sub_lot_5_5.maintainer_validated = true` avec date `2026-08-14`.

Cette validation clôt le gate d'implémentation 5.5 mais **n'autorise pas le Lot 5.6**. `authorized_sub_lot` reste `5.5` jusqu'à une nouvelle décision explicite du mainteneur.

La prochaine étape autorisée est la préparation et l'audit de la conception/Acceptance du Lot 5.6. Aucune implémentation 5.6 ne peut commencer avant un nouveau gate normatif et une autorisation mainteneur explicite.
