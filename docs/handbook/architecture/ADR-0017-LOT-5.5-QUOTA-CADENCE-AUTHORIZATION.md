# ADR-0017 — Autorisation du Lot 5.5 Quotas et cadence

Date : 2026-08-14
Statut : accepté par le mainteneur

## Contexte

Les sous-lots 5.1 à 5.4 sont validés par le mainteneur. La consolidation sécurité pré-5.5 a été auditée, corrigée puis explicitement validée le 2026-08-14. Le Concept et les critères d'Acceptance dédiés au Lot 5.5 ont ensuite fait l'objet d'un audit croisé avec les invariants du scheduler 5.4 et la baseline sécurité.

Les corrections issues de cet audit ont été intégrées dans les documents normatifs 5.5. Le maintien d'une interdiction générale de 5.5 dans le Handbook serait donc contradictoire avec `PROJECT-STATUS.json`, `docs/handoff/PROGRESS.json` et la roadmap.

## Décision

Le mainteneur autorise explicitement l'implémentation du seul sous-lot **5.5 — Quotas et cadence**.

Les documents normatifs d'implémentation sont :

- `docs/handoff/LOT-5.5-QUOTA-CADENCE-CONCEPT.md` ;
- `docs/handoff/LOT-5.5-QUOTA-CADENCE-ACCEPTANCE.md`.

Le Lot 5.5 doit préserver les invariants du Lot 5.4 : scheduler persistant, priorité et fairness, leases, heartbeat, fencing, concurrence, crash recovery, discovery périodique et `Sync now` comme boost de priorité uniquement.

La baseline sécurité pré-5.5 reste obligatoire et ne peut pas être affaiblie par le moteur quota/cadence.

L'autorisation 5.5 ne vaut ni validation de son implémentation ni autorisation des lots suivants. À la fin de 5.5, Codex doit produire ses preuves de validation puis s'arrêter pour audit et validation explicite du mainteneur.

## Gates permanents

- baseline sécurité pré-5.5 : **validée mainteneur le 2026-08-14** ;
- Concept 5.5 : **validé mainteneur le 2026-08-14** ;
- Acceptance 5.5 : **validée mainteneur le 2026-08-14** ;
- audit croisé Concept / Acceptance / 5.4 / sécurité : **réussi après corrections** ;
- `authorized_sub_lot = 5.5` ;
- Lot 5.6 et suivants : **non autorisés** jusqu'à une nouvelle validation explicite du mainteneur.

## Contraintes majeures 5.5

Le moteur 5.5 applique notamment : modèle hybride observations fournisseur + compteurs locaux, plusieurs fenêtres de quota simultanées, marge de sécurité 5 % par défaut, réserve current 20 % par défaut, quota inconnu en fonctionnement prudent, charge quota atomique PostgreSQL avant appel, distinction provider/stream backoff et respect de `Retry-After`.

Seul `current` peut utiliser la réserve protégée. `Sync now` ne contourne jamais les gardes quota, backoff, lease, fencing ou concurrence.

Les tests 5.5 utilisent exclusivement fixtures, transports mockés et PostgreSQL de recette : aucun appel fournisseur réel ni consommation de crédits n'est autorisé pendant la recette.

## Conséquences

Codex peut commencer l'implémentation du Lot 5.5 uniquement. Toute contradiction avec les documents normatifs, tout besoin d'affaiblir 5.4 ou la sécurité, ou toute nécessité d'effectuer un appel fournisseur réel impose un STOP et un arbitrage mainteneur.

Le Lot 5.6 reste explicitement hors périmètre et interdit tant que 5.5 n'a pas été implémenté, audité et validé séparément.
