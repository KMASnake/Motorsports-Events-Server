# Lot 5.3 — Validation de l’implémentation Découverte

Date : 2026-08-12

Statut : implémenté, en attente d’audit mainteneur

## Livré

- migration PostgreSQL `0009_provider_discovery`, versionnée et réversible ;
- résultats de découverte distincts des liens fournisseur/championnat ;
- historique durable des exécutions de découverte ;
- adaptateurs réels OCBlackTop et TheSportsDB, sans synchronisation Events ;
- OCBlackTop : catalogue déclaratif `adapter-known-catalog`, test de connexion minimal sur le endpoint officiel `/{series}/events`; aucun endpoint `/sports` supposé ;
- TheSportsDB : `all_leagues.php`, résultat `partial` par défaut et `complete` uniquement sur configuration explicite sûre ;
- contrôle HTTPS/hôtes autorisés, redirections interdites, délai et taille bornés ;
- quota sûr inconnu bloqué avant réseau ;
- comptage unique des requêtes en succès, 401, 429, 5xx et timeout, y compris pour le test de connexion ;
- garde conservative de la réserve mensuelle dédiée à l’année courante ;
- redécouverte idempotente, divergence proposée séparée de la configuration approuvée ;
- association manuelle à un championnat existant ou création locale explicite ;
- adoption explicite et auditée, lien laissé `inactive` ;
- revalidation de la version et du JSON de `proposed_source_config` au moment de l’adoption ;
- trois absences lors de cycles complets avant l’état `not_found` ;
- configuration 30 jours par défaut, minimum 7 jours, calcul d’échéance sans scheduler ;
- endpoints administratifs authentifiés pour connexion, découverte, association, adoption et historique.

## Validation exécutée

- lint complet : OK ;
- typecheck API, Web et types : OK ;
- tests API : 118 réussis ;
- tests Web : 29 réussis ;
- tests adaptateurs 5.3 : 3 réussis ;
- builds API, Web et types : OK ;
- migration PostgreSQL appliquée dans une pile Docker isolée : OK.
- rollback puis réapplication de `0009_provider_discovery` et `0010_provider_discovery_completeness` : OK.

## Validation réelle des fournisseurs

- real OCBlackTop validation = pending maintainer credentials ;
- real TheSportsDB validation = pending maintainer credentials ;
- requêtes réelles consommées pendant cette correction : 0.

La stratégie OCBlackTop a été vérifiée dans la documentation officielle
actuelle (`https://ocblacktop.com/api`) et dans l’adaptateur historique du
projet. Les endpoints de série documentés sont de la forme
`/v1/{series}/events`; aucune route globale `/sports` n’y est documentée.

Les tests automatiques utilisent des réponses HTTP déterministes injectées. Aucun crédit des APIs réelles n’est consommé en CI.

## Limites volontaires

- aucune récupération ni synchronisation d’événements ;
- aucun scheduler périodique ;
- aucun moteur complet de quotas ;
- aucune interface Web Fournisseurs ;
- aucun travail du Lot 5.4 ou ultérieur.

Une recette manuelle avec les credentials réels est requise pour la validation mainteneur.
