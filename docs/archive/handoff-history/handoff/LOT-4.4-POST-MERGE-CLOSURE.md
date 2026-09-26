# Lot 4.4 — Clôture post-fusion

Date : 2026-08-12

Statut : `merged-and-user-validated`

## Fusion

Le Lot 4.4 — Authentification de la console d'administration — a été fusionné dans `main` via la PR #28.

- branche source : `codex/lot-4.4`
- SHA final de branche : `5428c1bc2c65193e2b0b623297ea366c2ddd196e`
- commit de fusion : `b42a97129a8aa1cb9a42ce01ba0affb8e5a848a1`
- PR : #28

## Validation acquise avant fusion

Le lot avait déjà reçu la validation explicite du mainteneur avant fusion.

- validation Windows + Docker Desktop + Chromium : acquise ;
- validation VPS Docker isolé : acquise ;
- lint : réussi ;
- typecheck : réussi ;
- 110 tests Node : réussis ;
- builds Web/API/types : réussis ;
- `./scripts/validate-repository.sh` : réussi ;
- workflow GitHub Actions `CI` #198 sur le SHA final de branche : réussi ;
- workflow GitHub Actions `Docker build` #74 sur le SHA final de branche : réussi.

La fusion dans `main` ne constitue pas une nouvelle validation utilisateur ; elle clôt le cycle de livraison déjà validé.

## Capacités validées

- compte administrateur singleton ;
- création initiale par CLI avec mot de passe Argon2id ;
- sessions opaques persistées côté serveur ;
- expiration après 1 heure d'inactivité et limite absolue de 8 heures ;
- cookie `HttpOnly`, `Secure`, `SameSite` ;
- protection CSRF ;
- page de login et protection de la navigation d'administration ;
- logout avec révocation serveur ;
- anti-bruteforce 5 échecs / 15 minutes puis blocage temporaire de 15 minutes ;
- audit des événements d'authentification sans secret ;
- coexistence avec le mécanisme HMAC technique existant ;
- recettes Windows et VPS reproductibles.

## Décisions permanentes

- le login humain n'utilise pas directement le secret HMAC technique ;
- aucun JWT d'authentification lisible par JavaScript n'est requis pour la console ;
- le mot de passe n'est jamais stocké ou journalisé en clair ;
- les sessions humaines sont révocables côté serveur ;
- la première version reste volontairement limitée à un seul administrateur ;
- la gestion multi-utilisateurs et les rôles complexes restent hors périmètre.

## Suite

Le prochain chantier souhaité concerne les Fournisseurs et le cœur de synchronisation API, avec notamment quotas mensuels, quotas par minute et reprise via curseur de synchronisation.

Conformément à la gouvernance décidée avec le mainteneur, ce prochain chantier ne doit pas être détaillé ni implémenté avant discussion et validation explicites de ses concepts fonctionnels et architecturaux.
