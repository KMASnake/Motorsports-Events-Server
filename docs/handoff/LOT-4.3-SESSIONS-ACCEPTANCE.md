# Lot 4.3 — Critères d'acceptation Sessions

## Préconditions

- base de référence : `main` après fusion du Lot 4.2 ;
- branche : `codex/lot-4.3-sessions` ;
- spécification : `docs/handoff/LOT-4.3-SESSIONS-SPEC.md` ;
- aucune modification de la production pendant les recettes.

## Données et migrations

- [ ] migration de création des sessions versionnée ;
- [ ] migration idempotente ;
- [ ] rollback réussi sur PostgreSQL isolé ;
- [ ] base Lot 4.2 migrée sans perte ;
- [ ] aucun SQL métier destructif exécuté au démarrage de l'API ;
- [ ] stockage UTC vérifié.

## API administration

- [ ] liste des sessions d'un événement ;
- [ ] création ;
- [ ] consultation ;
- [ ] modification ;
- [ ] suppression ;
- [ ] pagination, tri et filtres côté serveur ;
- [ ] validation des références et types ;
- [ ] 401 sans authentification ;
- [ ] 403 sans rôle administrateur ;
- [ ] succès avec rôle administrateur ;
- [ ] journal d'audit sans secret.

## API publique

- [ ] seules les sessions publiées d'événements visibles sont exposées ;
- [ ] aucun `provider_key`, `external_id`, origine ou donnée d'audit ;
- [ ] ordre temporel stable ;
- [ ] filtres documentés et validés.

## Règles métier

- [ ] types contrôlés : practice, qualifying, sprint, warmup, race, other ;
- [ ] fin >= début ;
- [ ] session traversant minuit acceptée ;
- [ ] passage DST couvert ;
- [ ] chevauchement autorisé par défaut ;
- [ ] création manuelle sans fournisseur.

## Interface

- [ ] sessions visibles depuis le contexte de l'événement ;
- [ ] création, modification et suppression fonctionnelles ;
- [ ] nom, type, horaires, statut et publication lisibles ;
- [ ] aucune métadonnée technique fournisseur dans le formulaire métier ;
- [ ] comportement correct à 1440×900 et 1280×720 ;
- [ ] aucune régression sur calendrier, liste, corrections, logos et filtres du Lot 4.2.

## Tests et qualité

- [ ] lint ;
- [ ] typecheck ;
- [ ] tests unitaires ;
- [ ] builds API/Web/Types ;
- [ ] tests PostgreSQL ;
- [ ] migration + rollback ;
- [ ] scénarios Chromium ;
- [ ] `npm audit --audit-level=high` sans vulnérabilité bloquante ;
- [ ] CI verte sur le SHA candidat exact ;
- [ ] recette VPS Docker isolée ;
- [ ] recette Windows ;
- [ ] validation explicite du mainteneur.

## Dette technique Lot 4.2

- [ ] décision documentée sur l'atomicité du journal d'audit ;
- [ ] décision documentée sur l'identité et l'authentification de l'ingestion fournisseur automatisée.

## Sortie du lot

Le Lot 4.3 ne peut être déclaré validé ni fusionné tant que les critères
ci-dessus ne sont pas satisfaits ou explicitement différés par une décision
documentée conforme au Handbook.
