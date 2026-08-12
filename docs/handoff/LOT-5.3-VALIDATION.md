# Lot 5.3 — Validation de l’implémentation Découverte

Date : 2026-08-12

Statut : implémenté, en attente d’audit mainteneur

## Livré

- migration PostgreSQL `0009_provider_discovery`, versionnée et réversible ;
- résultats de découverte distincts des liens fournisseur/championnat ;
- historique durable des exécutions de découverte ;
- adaptateurs réels OCBlackTop et TheSportsDB, sans synchronisation Events ;
- contrôle HTTPS/hôtes autorisés, redirections interdites, délai et taille bornés ;
- comptage réel des requêtes et garde conservative de la réserve annuelle ;
- redécouverte idempotente, divergence proposée séparée de la configuration approuvée ;
- association manuelle à un championnat existant ou création locale explicite ;
- adoption explicite et auditée, lien laissé `inactive` ;
- trois absences lors de cycles complets avant l’état `not_found` ;
- configuration 30 jours par défaut, minimum 7 jours, calcul d’échéance sans scheduler ;
- endpoints administratifs authentifiés pour connexion, découverte, association, adoption et historique.

## Validation exécutée

- lint complet : OK ;
- typecheck API, Web et types : OK ;
- tests API : 108 réussis ;
- tests Web : 29 réussis ;
- tests adaptateurs 5.3 : 3 réussis ;
- builds API, Web et types : OK ;
- migration PostgreSQL appliquée dans une pile Docker isolée : OK.
- rollback puis réapplication de `0009_provider_discovery` : OK.

Les tests automatiques utilisent des réponses HTTP déterministes injectées. Aucun crédit des APIs réelles n’est consommé en CI.

## Limites volontaires

- aucune récupération ni synchronisation d’événements ;
- aucun scheduler périodique ;
- aucun moteur complet de quotas ;
- aucune interface Web Fournisseurs ;
- aucun travail du Lot 5.4 ou ultérieur.

Une recette manuelle avec les credentials réels est requise pour la validation mainteneur.
