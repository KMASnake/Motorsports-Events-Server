# Roadmap

- Lot 4.1 : validé
- Lot 4.2 : validé
- Lot 4.3 : validé utilisateur, fusionné dans `main` via PR #27 le 2026-08-11
- Lot 4 : terminé fonctionnellement
- Lot 4.4 : authentification de la console d'administration, validée utilisateur et fusionnée dans `main` via PR #28 le 2026-08-12
- Prochain chantier souhaité : Fournisseurs et cœur de synchronisation API — concepts à discuter et valider avec le mainteneur avant détaillage de la roadmap
- Lot 5 : futur

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

## Suite — Fournisseurs et synchronisation

Le prochain chantier souhaité concerne la page Fournisseurs et le cœur de synchronisation API, avec notamment :

- gestion des quotas mensuels ;
- gestion des quotas par minute ;
- persistance et reprise d'un curseur de synchronisation.

Conformément à la gouvernance décidée avec le mainteneur, les concepts détaillés de ce chantier ne sont pas encore figés. Ils doivent être discutés et explicitement validés avant toute nouvelle mise à jour détaillée de la roadmap, spécification ou implémentation.
