# Roadmap

- Lot 4.1 : validé
- Lot 4.2 : validé
- Lot 4.3 : validé utilisateur, fusionné dans `main` via PR #27 le 2026-08-11
- Lot 4 : terminé fonctionnellement
- Lot 4.4 : authentification de la console d'administration, validée utilisateur et fusionnée dans `main` via PR #28 le 2026-08-12
- Lot 5 : Fournisseurs et moteur de synchronisation API — Phase 0 validée ; 5.1 validé ; 5.2 validé ; 5.3 validé ; concept/acceptance 5.4 validés et 5.4 autorisé

## Lot 4.4 — Authentification administration — TERMINÉ

Le Lot 4.4 a été fusionné dans `main` via la PR #28, commit de fusion `b42a97129a8aa1cb9a42ce01ba0affb8e5a848a1`.

Capacités validées :

- un seul compte administrateur pour cette première version ;
- création du compte initial via une commande d'initialisation dédiée ;
- mot de passe hashé avec Argon2id ;
- page de connexion avec identifiant et mot de passe ;
- sessions opaques gérées côté serveur ;
- cookie de session `HttpOnly`, `Secure` et `SameSite` ;
- protection CSRF ;
- redirection des pages d'administration non authentifiées vers le login ;
- déconnexion avec révocation immédiate de la session serveur ;
- durée absolue maximale de 8 heures ;
- expiration après 1 heure d'inactivité ;
- protection anti-bruteforce : 5 échecs sur 15 minutes puis blocage temporaire de 15 minutes ;
- audit des événements d'authentification sans secret ;
- coexistence avec le mécanisme HMAC technique existant.

Validation finale : Windows + Docker Desktop + Chromium, VPS Docker isolé, 110 tests Node, lint, typecheck, builds et validation dépôt réussis. Les workflows CI #198 et Docker build #74 sont verts sur le SHA final de branche `5428c1bc2c65193e2b0b623297ea366c2ddd196e`.

La clôture post-fusion est consignée dans `docs/handoff/LOT-4.4-POST-MERGE-CLOSURE.md`.

## Lot 5 — Fournisseurs et moteur de synchronisation API

Statut : `sub-lot-5.4-authorized-not-started`.

La conception générale reste définie par `docs/handoff/LOT-5-PROVIDERS-SYNC-CONCEPT.md`, la SPEC et l'errata. Les décisions détaillées de 5.3 et 5.4 sont normatives via leurs documents dédiés et priment sur les formulations Phase 0 lorsqu'elles les amendent explicitement.

### État des sous-lots

- 5.1 — DB + contrats : validé mainteneur ;
- 5.2 — secrets et configuration fournisseur : validé mainteneur ;
- 5.3 — découverte championnats et source config : validé mainteneur ;
- 5.4 — scheduler persistant, curseurs et leases : concept + acceptance validés, implémentation autorisée ;
- 5.5+ : non autorisés tant que 5.4 n'est pas audité et validé.

### Lot 5.3 — état validé

5.3 fournit les vrais adaptateurs OCBlackTop et TheSportsDB pour découverte/test de connexion, sans synchronisation Events, avec persistance des découvertes, association manuelle, fallback manuel complet même sans discovery, divergence/adoption explicite et historique `DISCOVERY`.

Règles conservées :

- aucune création automatique de championnat métier ;
- aucun démarrage automatique de synchronisation ;
- plusieurs sources possibles pour un championnat, une seule principale active en V1 ;
- configuration source manuelle possible même sans discovery ;
- catalogue OCBlackTop non bloquant pour un nouvel external_id utilisant une stratégie déjà supportée ;
- découverte périodique 30 jours par défaut, minimum 7 jours, exécution effective branchée sur le scheduler 5.4 ;
- quota inconnu bloque les appels de découverte ;
- aucune suppression automatique d'un championnat fournisseur disparu.

### Lot 5.4 — Scheduler, curseurs et leases

Documents normatifs :

- `docs/handoff/LOT-5.4-SCHEDULER-CONCEPT.md` ;
- `docs/handoff/LOT-5.4-SCHEDULER-ACCEPTANCE.md`.

Règles validées :

- deux streams persistants `current` et `historical` ;
- historique subdivisé logiquement en `recent_catchup` et `deep_history` ;
- `current` utilise une fenêtre glissante de 7 jours par défaut, configurable, et ne repart plus systématiquement au 1er janvier ;
- la partie antérieure à la fenêtre current est couverte par le rattrapage/historique ;
- changement d'année : année terminée priorisée en rattrapage sans perdre la progression historique profonde ;
- round-robin pondéré global `3/2/1` par défaut pour `current/recent/deep`, configurable ;
- une seule unité adaptateur bornée par tour ;
- pool global de 4 workers par défaut ;
- concurrence fournisseur de 1 par défaut ;
- leases PostgreSQL 120 s, heartbeat ~30 s ;
- fencing token obligatoire pour empêcher un ancien worker de committer après perte de lease ;
- résultat synthétique + curseur + état stream + run commités atomiquement en 5.4 ;
- reprise après crash au dernier curseur durable, run abandonné `interrupted` ;
- reset `current` et `historical` séparés, explicites, audités et non destructifs ;
- `Synchroniser maintenant` = boost de priorité de 15 min par défaut, jamais bypass quota/backoff/lease/concurrence ;
- désactiver un championnat = retrait API publique + arrêt synchro, conservation intégrale des données et curseurs ;
- réactivation = republication, current recalculé sur fenêtre glissante, historique repris et current temporairement priorisé ;
- 5.4 implémente les états génériques d'erreur/reprise ; la politique complète 429/Retry-After/backoff/jitter reste en 5.5 ;
- le scheduler 5.4 devient l'unique mécanisme persistant pouvant déclencher la découverte périodique de 5.3 ;
- aucune ingestion métier complète des Events en 5.4.

### Lots suivants

- 5.5 — moteur complet quotas/cadence, 429, Retry-After, backoff exponentiel et jitter ;
- 5.6 — bootstrap métier, historique et boucle de synchronisation utilisant la fenêtre current glissante définie par 5.4 ;
- 5.7 — normalisation, idempotence, mappings, corrections et présence fournisseur ;
- 5.8 — runs/logs/alertes complets ;
- 5.9 — interface Fournisseurs fidèle aux maquettes validées ;
- 5.10 — acceptation finale.

### Valeurs par défaut validées

- réserve quota mensuel année courante : 30 % ;
- concurrence fournisseur : 1 ;
- pool global workers : 4 ;
- fenêtre current : 7 jours ;
- poids scheduler current/recent/deep : 3/2/1 ;
- lease : 120 secondes ;
- heartbeat lease : environ 30 secondes ;
- boost `Synchroniser maintenant` : 15 minutes ;
- seuil d'événement absent : 3 cycles complets ;
- rétention logs détaillés : 30 jours ;
- rotation logs : quotidienne ou 100 Mo, premier seuil atteint ;
- découverte automatique : 30 jours par défaut, minimum 7 jours ;
- championnat fournisseur non retrouvé : 3 découvertes complètes consécutives.

### Interface validée

Les concepts visuels restent validés pour page Fournisseurs, détail fournisseur, Configuration, Quotas, Championnats, Synchronisation, Historique & logs et import logo championnat. L'implémentation UI complète reste prévue en 5.9 et doit respecter `docs/handoff/UI_CONTRACT.md` et `docs/ui-reference/validated-mockups`.

### Stop rule

Après chaque sous-lot, Codex doit s'arrêter pour audit et validation explicite du mainteneur. L'autorisation actuelle porte uniquement sur 5.4 et n'autorise ni 5.5 ni les sous-lots suivants.
