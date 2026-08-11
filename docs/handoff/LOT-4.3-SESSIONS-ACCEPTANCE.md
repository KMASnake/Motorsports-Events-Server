# Lot 4.3 — Critères d'acceptation Sessions

## Préconditions

- base de référence : `main` après fusion du Lot 4.2 ;
- branche : `codex/lot-4.3-sessions` ;
- spécification : `docs/handoff/LOT-4.3-SESSIONS-SPEC.md` ;
- aucune modification de la production pendant les recettes.

## Données et migrations

- [x] migration de création des sessions versionnée ;
- [x] migration idempotente ;
- [x] rollback réussi sur PostgreSQL isolé ;
- [x] base Lot 4.2 migrée sans perte ;
- [x] aucun SQL métier destructif exécuté au démarrage de l'API ;
- [x] stockage UTC vérifié.
- [x] migration `0005_event_session_title` idempotente et rollback protégé ;
- [x] aucune reprise automatique ambiguë des anciennes lignes multi-sessions ;

## API administration

- [x] liste des sessions d'un événement ;
- [x] création ;
- [x] consultation ;
- [x] modification ;
- [x] suppression ;
- [x] pagination, tri et filtres côté serveur ;
- [x] validation des références et types ;
- [x] 401 sans authentification ;
- [x] 403 sans rôle administrateur ;
- [x] succès avec rôle administrateur ;
- [x] journal d'audit sans secret.

## API publique

- [x] seules les sessions publiées d'événements visibles sont exposées ;
- [x] aucun `provider_key`, `external_id`, origine ou donnée d'audit ;
- [x] ordre temporel stable ;
- [x] filtres documentés et validés.

## Règles métier

- [x] types contrôlés : practice, qualifying, sprint, warmup, race, other ;
- [x] fin >= début ;
- [x] session traversant minuit acceptée ;
- [x] passage DST couvert ;
- [x] chevauchement autorisé par défaut ;
- [x] création manuelle sans fournisseur.

## Corrections Sessions

- [x] valeurs typées sur `title`, `starts_at`, `ends_at`, `status`, `published`
  et `description` uniquement ;
- [x] synchronisation fournisseur non destructive et convergence automatique ;
- [x] accepter/restaurer fournisseur et conserver/modifier l'override ;
- [x] pagination, filtres et tri serveur ;
- [x] sérialisation des résolutions, synchronisations et overrides concurrents ;
- [x] audit atomique unique et rollback intégral si l'audit échoue ;
- [x] suggestions fournisseur et locales dédupliquées ;
- [x] API publique limitée à la valeur effective ;
- [x] recette Corrections validée explicitement par le mainteneur.

## Interface

- [x] aucune sous-liste ni CRUD multi-sessions dans la fiche Événement ;
- [x] champ `Intitulé de session` intégré au formulaire Événement existant ;
- [x] combobox alimentée par toutes les valeurs fournisseur et enregistrées ;
- [x] intitulé inédit accepté puis proposé à la prochaine ouverture ;
- [x] aucune distinction fournisseur/local ni métadonnée technique visible ;
- [x] comportement correct à 1440×900, 1280×720 et largeur mobile ;
- [x] aucune régression sur calendrier, liste, corrections, logos et filtres du Lot 4.2.

## Tests et qualité

- [x] lint ;
- [x] typecheck ;
- [x] tests unitaires ;
- [x] builds API/Web/Types ;
- [x] tests PostgreSQL ;
- [x] migration + rollback ;
- [x] scénarios Chromium ;
- [x] `npm audit --audit-level=high` sans vulnérabilité bloquante ;
- [x] CI verte sur le SHA candidat exact `b055ec8` ;
- [ ] recette VPS Docker isolée ;
- [ ] recette Windows ;
- [ ] validation explicite du mainteneur.

## Dette technique Lot 4.2

- [x] décision validée sur l'atomicité du journal d'audit dans l'ADR-0012 ;
- [x] décision validée sur l'identité et l'authentification de l'ingestion
  fournisseur automatisée dans l'ADR-0012.

## Sortie du lot

Le Lot 4.3 ne peut être déclaré validé ni fusionné tant que les critères
ci-dessus ne sont pas satisfaits ou explicitement différés par une décision
documentée conforme au Handbook.
