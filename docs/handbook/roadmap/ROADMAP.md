# Roadmap

- Lot 4.1 : validé
- Lot 4.2 : validé
- Lot 4.3 : validé utilisateur, fusionné dans `main` via PR #27 le 2026-08-11
- Lot 4 : terminé fonctionnellement
- Lot 4.4 : authentification de la console d'administration, validée utilisateur et fusionnée dans `main` via PR #28 le 2026-08-12
- Lot 5 : Fournisseurs et moteur de synchronisation API — Phase 0 validée ; 5.1 validé ; 5.2 validé ; 5.3 validé ; 5.4 validé ; baseline sécurité pré-5.5 validée ; conception 5.5 revue, documentation normative à créer avant toute autorisation d'implémentation

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

Statut : `sub-lot-5.5-concept-reviewed-awaiting-normative-docs`.

La conception générale reste définie par `docs/handoff/LOT-5-PROVIDERS-SYNC-CONCEPT.md`, la SPEC et l'errata. Les décisions détaillées de 5.3 et 5.4 sont normatives via leurs documents dédiés et priment sur les formulations Phase 0 lorsqu'elles les amendent explicitement. La revue complète de conception 5.5 est validée au niveau mainteneur, mais l'implémentation reste non autorisée tant que les documents normatifs Concept + Acceptance 5.5 ne sont pas créés et validés.

### État des sous-lots

- 5.1 — DB + contrats : validé mainteneur ;
- 5.2 — secrets et configuration fournisseur : validé mainteneur ;
- 5.3 — découverte championnats et source config : validé mainteneur ;
- 5.4 — scheduler persistant, curseurs et leases : validé mainteneur ;
- consolidation générale et sécurité pré-5.5 : validée mainteneur ;
- 5.5 — quotas et cadence : conception revue ; documents normatifs à créer ; implémentation NON autorisée ;
- 5.6+ : non autorisés.

### Lot 5.3 — état validé

5.3 fournit les vrais adaptateurs OCBlackTop et TheSportsDB pour découverte/test de connexion, sans synchronisation Events, avec persistance des découvertes, association manuelle, fallback manuel complet même sans discovery, divergence/adoption explicite et historique `DISCOVERY`.

Règles conservées :

- aucune création automatique de championnat métier ;
- aucun démarrage automatique de synchronisation ;
- plusieurs sources possibles pour un championnat, une seule principale active en V1 ;
- configuration source manuelle possible même sans discovery ;
- catalogue OCBlackTop non bloquant pour un nouvel external_id utilisant une stratégie déjà supportée ;
- découverte périodique 30 jours par défaut, minimum 7 jours, exécution effective branchée sur le scheduler 5.4 ;
- en 5.5, un quota inconnu n'empêchera plus systématiquement les appels : fonctionnement prudent avec compteur local et intervalle minimal recommandé ;
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

### Lot 5.5 — Quotas et cadence — conception revue

Décisions validées pour formalisation dans les futurs documents normatifs 5.5 :

- plusieurs fenêtres simultanées possibles : minute, heure, jour, mois et intervalle minimal ;
- modèle hybride : headers/metadata fournisseur fiables prioritaires, compteur local en fallback et garde de sécurité ;
- toute requête réellement envoyée est comptée comme potentiellement consommée ; un blocage local avant envoi compte zéro ;
- compteur fournisseur commun à current, recent, deep history, discovery manuelle/périodique et test connexion ;
- marge de sécurité : 5 % par défaut, configurable de 0 à 20 % ;
- réserve globale current : 20 % par défaut, configurable de 0 à 50 % ou en valeur absolue ;
- seule la classe `current` peut utiliser la réserve ; `Sync now` peut l'utiliser uniquement pour `current` et ne contourne aucune règle de sécurité ;
- quota inconnu : fonctionnement prudent autorisé avec compteur local et intervalle minimal recommandé, état ACP `Quota inconnu`, pas de réserve % sans limite chiffrée ;
- cadence dynamique calculée à partir du budget restant et du temps avant reset, surtout pour recent/deep ; burst contrôlé permis dans les limites court terme ;
- distinction `provider_backoff` / `stream_backoff` ; scope inconnu traité conservativement au niveau fournisseur ;
- `429` avec `Retry-After` prioritaire ; sans `Retry-After`, backoff progressif avec jitter ;
- `401/403` : suspension immédiate du fournisseur, sans retries automatiques répétés ;
- la contrainte la plus restrictive détermine `next_eligible_at` et une raison de blocage explicite ;
- réservation/charge quota atomique PostgreSQL avant appel pour garantir la sûreté multi-instance ;
- configuration administrateur séparée des observations fournisseur ; une observation ne modifie jamais silencieusement la policy ;
- restauration des valeurs recommandées de l'adaptateur sans remise à zéro des compteurs ;
- UI finale Quotas & cadence reste prévue en 5.9 ; 5.5 fournit d'abord moteur, données, API et diagnostics.

### Lots suivants

- 5.5 — moteur complet quotas/cadence selon les décisions ci-dessus, après création et validation de ses documents normatifs ;
- 5.6 — bootstrap métier, historique et boucle de synchronisation utilisant la fenêtre current glissante définie par 5.4 ;
- 5.7 — normalisation, idempotence, mappings, corrections et présence fournisseur ;
- 5.8 — runs/logs/alertes complets ;
- 5.9 — interface Fournisseurs fidèle aux maquettes validées ;
- 5.10 — acceptation finale.

### Valeurs par défaut validées

- marge de sécurité quota : 5 % ;
- réserve globale quota `current` : 20 % ;
- réserve configurable : 0 à 50 % ou valeur absolue ;
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

Après chaque sous-lot, Codex doit s'arrêter pour audit et validation explicite du mainteneur. Aucun sous-lot n'est actuellement autorisé à l'implémentation. La prochaine étape est la création et validation de `LOT-5.5-QUOTA-CADENCE-CONCEPT.md` et `LOT-5.5-QUOTA-CADENCE-ACCEPTANCE.md`.
