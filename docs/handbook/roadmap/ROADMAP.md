# Roadmap

- Lot 4.1 : validé
- Lot 4.2 : validé
- Lot 4.3 : validé utilisateur, fusionné dans `main` via PR #27 le 2026-08-11
- Lot 4 : terminé fonctionnellement
- Lot 4.4 : authentification de la console d'administration, validée utilisateur et fusionnée dans `main` via PR #28 le 2026-08-12
- Lot 5 : Fournisseurs et moteur de synchronisation API — Phase 0 validée ; 5.1 validé ; 5.2 validé ; 5.3 validé ; 5.4 validé ; baseline sécurité pré-5.5 validée ; Concept + Acceptance 5.5 validés après audit croisé ; implémentation 5.5 autorisée

## Lot 4.4 — Authentification administration — TERMINÉ

Le Lot 4.4 a été fusionné dans `main` via la PR #28, commit de fusion `b42a97129a8aa1cb9a42ce01ba0affb8e5a848a1`.

Capacités validées : authentification administrateur, Argon2id, sessions serveur, CSRF, cookies sécurisés, expiration, anti-bruteforce et audit. Validation finale Windows + Docker Desktop + Chromium et VPS Docker isolé réussie. La clôture post-fusion est consignée dans `docs/handoff/LOT-4.4-POST-MERGE-CLOSURE.md`.

## Lot 5 — Fournisseurs et moteur de synchronisation API

Statut : `sub-lot-5.5-authorized-ready-for-implementation`.

La conception générale reste définie par `docs/handoff/LOT-5-PROVIDERS-SYNC-CONCEPT.md`, la SPEC et l'errata. Les documents dédiés des sous-lots priment lorsqu'ils amendent explicitement les formulations Phase 0.

### État des sous-lots

- 5.1 — DB + contrats : validé mainteneur ;
- 5.2 — secrets et configuration fournisseur : validé mainteneur ;
- 5.3 — découverte championnats et source config : validé mainteneur ;
- 5.4 — scheduler persistant, curseurs et leases : validé mainteneur ;
- consolidation générale et sécurité pré-5.5 : validée mainteneur ;
- 5.5 — quotas et cadence : Concept + Acceptance validés après audit croisé avec 5.4 et sécurité ; **implémentation autorisée** ;
- 5.6+ : non autorisés.

### Lot 5.4 — Scheduler, curseurs et leases

Documents normatifs : `docs/handoff/LOT-5.4-SCHEDULER-CONCEPT.md` et `docs/handoff/LOT-5.4-SCHEDULER-ACCEPTANCE.md`.

Invariants conservés : streams current/historical, fenêtre current glissante 7 jours par défaut, recent/deep history, round-robin 3/2/1, work units bornées, pool global 4, concurrence provider 1, leases PostgreSQL 120 s, heartbeat ~30 s, fencing obligatoire, reprise après crash, reset non destructif, Sync now comme boost uniquement, désactivation sans suppression, discovery périodique via le scheduler unique.

### Lot 5.5 — Quotas et cadence — AUTORISÉ

Documents normatifs validés :

- `docs/handoff/LOT-5.5-QUOTA-CADENCE-CONCEPT.md` ;
- `docs/handoff/LOT-5.5-QUOTA-CADENCE-ACCEPTANCE.md`.

Audit croisé Concept ↔ Acceptance ↔ 5.4 ↔ sécurité effectué et corrections appliquées le 2026-08-14.

Règles autorisées :

- fenêtres simultanées minute/heure/jour/mois + intervalle minimal ;
- modèle hybride observations fournisseur fiables + compteurs locaux conservateurs ;
- quota inconnu non bloquant par principe : fonctionnement prudent avec compteur local et intervalle minimal adaptateur ;
- marge 5 % par défaut, configurable 0–20 % ;
- réserve globale current 20 % par défaut, configurable 0–50 % ou absolue ;
- seule la classe current peut consommer la réserve ;
- budget provider commun à sync, discovery et test connexion ;
- cadence dynamique surtout pour recent/deep avec burst contrôlé ;
- provider_backoff et stream_backoff distincts ;
- Retry-After valide prioritaire ;
- 401/403 sur endpoint authentifié => suspension immédiate provider ;
- contrainte la plus restrictive => `next_eligible_at` + `blocking_reason` ;
- décision et charge quota atomiques PostgreSQL avant outbound ;
- non-émission locale prouvée => compensation possible ; appel réellement émis => pas de remboursement automatique ;
- rejet métier par stale fencing après émission => aucun remboursement quota ;
- observations quota strictement normalisées, sans headers bruts, credentials, secrets ou bodies fournisseur ;
- configuration administrateur séparée des observations ; restaurer les recommandations ne remet pas les compteurs à zéro ;
- 5.5 fournit moteur, persistance, API admin et diagnostics ; finition UI pixel-perfect en 5.9 ;
- validation exclusivement avec fixtures/mocks/fake transports : zéro appel fournisseur réel et zéro crédit consommé.

### Lots suivants

- 5.5 — **autorisé maintenant** ; implémenter uniquement le moteur quotas/cadence et produire les preuves d'acceptation ;
- 5.6 — bootstrap métier, historique et boucle de synchronisation : non autorisé ;
- 5.7 — normalisation, idempotence, mappings, corrections et présence fournisseur : non autorisé ;
- 5.8 — runs/logs/alertes complets : non autorisé ;
- 5.9 — interface Fournisseurs fidèle aux maquettes validées : non autorisé ;
- 5.10 — acceptation finale : non autorisé.

### Valeurs par défaut validées

- marge de sécurité quota : 5 % ;
- réserve globale quota current : 20 % ;
- réserve configurable : 0 à 50 % ou valeur absolue ;
- concurrence fournisseur : 1 ;
- pool global workers : 4 ;
- fenêtre current : 7 jours ;
- poids scheduler current/recent/deep : 3/2/1 ;
- lease : 120 secondes ;
- heartbeat lease : environ 30 secondes ;
- boost Synchroniser maintenant : 15 minutes ;
- découverte automatique : 30 jours par défaut, minimum 7 jours.

### Interface validée

Les concepts visuels restent validés pour page Fournisseurs, détail fournisseur, Configuration, Quotas, Championnats, Synchronisation, Historique & logs et import logo championnat. L'implémentation UI complète reste prévue en 5.9 et doit respecter `docs/handoff/UI_CONTRACT.md` et `docs/ui-reference/validated-mockups`.

### Stop rule

Codex est autorisé à implémenter **uniquement le sous-lot 5.5**. Après implémentation et production des preuves de validation, il doit s'arrêter pour audit et validation explicite du mainteneur. Aucun travail 5.6 ou ultérieur n'est autorisé.
