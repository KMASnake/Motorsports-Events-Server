# Codex — Instructions de reprise

## Ordre de lecture obligatoire

Avant toute modification, lire dans cet ordre :

1. `PROJECT-HANDBOOK.md` — règles permanentes et source de vérité officielle ;
2. `CODEX-HANDBOOK.md` — procédure permanente applicable aux assistants ;
3. `README.md` ;
4. `PROJECT-STATUS.json` ;
5. `docs/handoff/PROGRESS.json` — état du lot courant ;
6. `docs/handoff/LOT-4.2-CODE-AUDIT-2026-08-03.md` — audit bloquant ;
7. `docs/handoff/LOT-4.2-AUDIT-ACTION-PLAN.md` — ordre de correction imposé ;
8. `docs/handbook/DECISIONS.md` et tous les ADR de
   `docs/handbook/architecture/` ;
9. les spécifications et critères du lot concerné dans `docs/handoff/` ;
10. les documents historiques utiles de `docs/handover/`.

Un document de lot ne peut pas contredire le Handbook. En cas d'écart, arrêter
la modification, documenter le conflit et faire évoluer la décision permanente
selon la procédure du Handbook.

## Base et état fiables

- Lot 4.1 : validé par l'utilisateur sur un VPS isolé ;
- Lot 4.2 : remédiation d'audit terminée ; validation globale rouverte pour le
  contrôle des logos du Tableau de bord signalé le 2026-08-10 ;
- une fusion dans `main`, une CI verte ou un déploiement technique ne constitue
  jamais à elle seule une validation utilisateur.

## Audit indépendant bloquant du lot 4.2

Le rapport `docs/handoff/LOT-4.2-CODE-AUDIT-2026-08-03.md` est obligatoire.
Les quatre constats P1 doivent être corrigés avant toute nouvelle fonctionnalité :

1. remplacer les écritures SQL destructives du démarrage par une migration
   versionnée, idempotente et réversible ;
2. obtenir une CI verte attachée au SHA final avec Node >= 22 et npm >= 10 ;
3. prouver l'authentification et l'autorisation de toutes les routes
   `/api/v1/admin/*` ;
4. typer chaque valeur de correction selon le champ métier concerné.

Codex doit suivre `docs/handoff/LOT-4.2-AUDIT-ACTION-PLAN.md`, documenter chaque
écart résiduel et ne jamais fusionner dans `main` sans validation utilisateur.
Une exigence d'audit ne peut être supprimée, différée ou contournée sans décision
écrite dans les fichiers de gouvernance.

## Contraintes absolues

- maquettes validées = contrat visuel ;
- objectif de fidélité >= 98 % ;
- calendrier par défaut, liste secondaire ;
- aucune régression Championnats ;
- catégorie facultative et aucune création implicite de catégorie ;
- création manuelle sans fournisseur externe ;
- aucune métadonnée fournisseur dans l'API publique ;
- les formulaires d'administration ne présentent pas les champs Slug, Origine
  ou Fuseau horaire ;
- compilation, Docker et tests obligatoires ;
- jeu de données de recette adapté obligatoire pour chaque nouvelle version,
  avec commandes d'injection, résultats attendus et nettoyage documentés.

## Documentation et décisions

Le Handbook contient uniquement les règles permanentes. `docs/handoff/`
conserve les règles spécifiques aux lots et `docs/handover/` l'historique déjà
versionné ; aucun de ces répertoires ne doit être supprimé lors de l'intégration.

Toute nouvelle décision permanente met à jour ensemble :

- `PROJECT-HANDBOOK.md` ;
- `docs/handbook/DECISIONS.md` ;
- `docs/handbook/CHANGELOG.md` ;
- l'ADR concerné ou un nouvel ADR.

## Avant toute pull request

- vérifier que tous les P1 de l'audit sont fermés avec preuves ;
- mettre à jour `PROJECT-STATUS.json` ;
- mettre à jour `docs/handoff/PROGRESS.json` ;
- synchroniser `docs/handover/PROGRESS.json` lorsqu'il est conservé comme
  miroir historique ;
- joindre les captures avant/après si l'interface change ;
- documenter les écarts résiduels ;
- indiquer précisément les commandes exécutées et leurs résultats ;
- référencer le SHA exact de la CI ;
- confirmer qu'aucune donnée de production n'a été modifiée.
