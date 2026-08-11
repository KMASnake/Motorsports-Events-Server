# Lot 4.4 — Authentification de la console d'administration

Date : 2026-08-11

Statut : `functional-decisions-approved-specification-pending`

## État de référence

Le Lot 4 est fonctionnellement terminé. Le Lot 4.3 est validé et fusionné dans
`main` via la PR #27. La duplication d'Événements existe déjà et convient au
mainteneur ; elle ne fait plus partie d'un lot à développer.

Le Lot 4.4 porte uniquement sur l'authentification humaine de la console
d'administration.

## Décisions fonctionnelles acquises

- un seul compte administrateur dans cette première version ;
- initialisation par une commande dédiée, sans mot de passe en clair stocké ou
  affiché ;
- page `/login` avec identifiant et mot de passe ;
- session côté serveur et cookie de session `HttpOnly`, `Secure` en production
  et `SameSite` approprié ;
- durée absolue de 8 heures et expiration après 1 heure d'inactivité ;
- invalidation immédiate côté serveur au logout ;
- cinq échecs en quinze minutes entraînent un blocage de quinze minutes ;
- succès de connexion réinitialisant le compteur ;
- message d'échec générique ;
- audit des succès, échecs, blocages et déconnexions sans secret ;
- coexistence avec le HMAC Bearer technique existant ;
- aucune gestion multi-utilisateurs, CAPTCHA, blocage permanent ou politique
  fondée uniquement sur l'IP.

## Phase 0 obligatoire

Produire et faire valider avant tout code :

- `docs/handoff/LOT-4.4-AUTH-SPEC.md` ;
- `docs/handoff/LOT-4.4-AUTH-ACCEPTANCE.md` ;
- `docs/handoff/LOT-4.4-AUTH-IMPACT-ANALYSIS.md` ;
- `docs/handoff/LOT-4.4-AUTH-MIGRATION-PLAN.md` ;
- `docs/handbook/architecture/ADR-0014-ADMIN-CONSOLE-AUTHENTICATION.md`.

La Phase 0 n'ajoute ni migration SQL, ni route, ni dépendance, ni composant
React. Après rédaction : arrêt obligatoire et validation du mainteneur.
