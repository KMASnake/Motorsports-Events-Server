# Roadmap

- Lot 4.1 : validé
- Lot 4.2 : validé
- Lot 4.3 : validé utilisateur, fusionné dans `main` via PR #27 le 2026-08-11
- Lot 4 : terminé fonctionnellement
- Lot 4.4 : authentification de la console d'administration, validée utilisateur et fusionnée dans `main` via PR #28 le 2026-08-12
- Lot 5 : Fournisseurs et moteur de synchronisation API — 5.1 à 5.6 validés par le mainteneur ; prochain gate 5.7-P identifié mais non autorisé

## Lot 4.4 — Authentification administration — TERMINÉ

Le Lot 4.4 a été fusionné dans `main` via la PR #28, commit de fusion `b42a97129a8aa1cb9a42ce01ba0affb8e5a848a1`.

Capacités validées : authentification administrateur, Argon2id, sessions serveur, CSRF, cookies sécurisés, expiration, anti-bruteforce et audit. Validation finale Windows + Docker Desktop + Chromium et VPS Docker isolé réussie. La clôture post-fusion est consignée dans `docs/handoff/LOT-4.4-POST-MERGE-CLOSURE.md`.

## Lot 5 — Fournisseurs et moteur de synchronisation API

Statut : `lot-5.6-maintainer-validated-awaiting-next-gate-decision`.

La conception générale reste définie par `docs/handoff/LOT-5-PROVIDERS-SYNC-CONCEPT.md`, la SPEC et l'errata. Les documents dédiés des sous-lots priment lorsqu'ils amendent explicitement les formulations Phase 0.

### État des sous-lots

- 5.1 — DB + contrats : validé mainteneur ;
- 5.2 — secrets et configuration fournisseur : validé mainteneur ;
- 5.3 — découverte championnats et source config : validé mainteneur ;
- 5.4 — scheduler persistant, curseurs et leases : validé mainteneur ;
- consolidation générale et sécurité pré-5.5 : validée mainteneur ;
- 5.5 — quotas et cadence : validé mainteneur le 2026-08-14 ;
- 5.6 — acquisition fournisseur durable : **validé globalement par le mainteneur le 2026-08-21** ;
- 5.7+ : non autorisés.

### Lot 5.4 — Scheduler, curseurs et leases

Documents normatifs : `docs/handoff/LOT-5.4-SCHEDULER-CONCEPT.md` et `docs/handoff/LOT-5.4-SCHEDULER-ACCEPTANCE.md`.

Invariants conservés : streams current/historical, fenêtre current glissante 7 jours par défaut, recent/deep history, round-robin 3/2/1, work units bornées, pool global 4, concurrence provider 1, leases PostgreSQL 120 s, heartbeat ~30 s, fencing obligatoire, reprise après crash, reset non destructif, Sync now comme boost uniquement, désactivation sans suppression, discovery périodique via le scheduler unique.

### Lot 5.5 — Quotas et cadence — VALIDÉ MAINTENEUR

Documents normatifs : `docs/handoff/LOT-5.5-QUOTA-CADENCE-CONCEPT.md`, `docs/handoff/LOT-5.5-QUOTA-CADENCE-ACCEPTANCE.md`, `docs/handoff/LOT-5.5-VALIDATION.md`, `docs/handoff/LOT-5.5-MAINTAINER-VALIDATION.md` et `docs/handbook/architecture/ADR-0018-LOT-5.5-MAINTAINER-VALIDATION.md`.

Audit croisé et ré-audit final réussis sans constat P1/P2/P3 ouvert. La recette PostgreSQL dédiée compte 61 cas réussis. Les règles quota/cadence, réserve current, backoff, fencing et sécurité restent normatives pour 5.6.

### Lot 5.6 — Acquisition fournisseur durable — VALIDÉ MAINTENEUR

Documents normatifs :

- `docs/handoff/LOT-5.6-ACQUISITION-CONCEPT.md` ;
- `docs/handoff/LOT-5.6-UI-CONTRACT.md` ;
- `docs/handoff/LOT-5.6-ACCEPTANCE.md` ;
- `docs/handoff/LOT-5.6-AUDIT-CORRECTIONS.md` ;
- `docs/handoff/LOT-5.6-CONSOLIDATION.md`.

Après validation de la conception consolidée puis implémentation, le gate final
5.6-I a obtenu 26/26 PASS. Le mainteneur a **globalement validé le Lot 5.6 le
2026-08-21**. Cette validation ne permet pas la fusion dans `main` et
n'autorise aucun travail 5.7+.

Invariants majeurs : futur `current` jusqu'à épuisement fournisseur, fenêtre chaude J→J+30 par défaut, finalisation 30 jours, recent catchup, deep history jusqu'à épuisement avec 5 saisons vides consécutives par défaut, checkpoints transactionnels, pré-1970, source rejouable sans versions dupliquées, overrides protégés, absence non destructive, cadence déléguée à 5.4/5.5 et sécurité HTTP ADR-0016.

### Lots suivants

- 5.7-P — tranche verticale de normalisation Production Preview : **prochain gate identifié, conçu, non autorisé** ;
- 5.7 — normalisation, idempotence, mappings, corrections et présence fournisseur : **non autorisé** ;
- 5.8 — runs/logs/alertes complets : non autorisé ;
- 5.9 — interface Fournisseurs fidèle aux maquettes validées : non autorisé ;
- 5.10 — acceptation finale : non autorisé.

### Valeurs par défaut validées

- marge de sécurité quota : 5 % ;
- réserve globale quota current : 20 % ;
- réserve configurable : 0 à 50 % ou valeur absolue ;
- concurrence fournisseur : 1 ;
- pool global workers : 4 ;
- fenêtre chaude current 5.6 : 30 jours ;
- finalisation 5.6 : 30 jours ;
- arrêt deep history : 5 saisons vides consécutives ;
- poids scheduler current/recent/deep : 3/2/1 ;
- lease : 120 secondes ;
- heartbeat lease : environ 30 secondes ;
- boost Synchroniser maintenant : 15 minutes ;
- découverte automatique : 30 jours par défaut, minimum 7 jours.

### Interface validée

Le contrat fonctionnel ACP 5.6 est validé en conception. La finition UI pixel-perfect reste prévue en 5.9 et doit respecter `docs/handoff/UI_CONTRACT.md` et `docs/ui-reference/validated-mockups`.

### Stop rule

**Aucun nouveau lot n'est autorisé en implémentation.** Le prochain gate
identifié, 5.7-P, doit attendre une autorisation mainteneur explicite. La
validation du Lot 5.6 n’autorise pas sa fusion dans `main`.
