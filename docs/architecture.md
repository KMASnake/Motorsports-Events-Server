# Architecture serveur

## Statut de ce document

Ce document décrit l’architecture officielle du dépôt à partir de la baseline certifiée `8a603232bfec44711cfac382e4f73687dd370e53`.

Deux générations de serveur coexistent encore dans le dépôt pendant la transition de production :

- **architecture cible et active en préproduction** : `apps/api` + `apps/web` + PostgreSQL ;
- **architecture legacy encore conservée pour la production historique** : `server/` en Python/FastAPI/SQLAlchemy.

La règle de développement est désormais la suivante : **aucune nouvelle fonctionnalité métier ne doit être ajoutée dans `server/`**. Le backend Python est gelé jusqu’au cutover de production, puis destiné à être supprimé avec ses migrations/tests spécifiques.

## Responsabilité du serveur central

Le serveur central :

- interroge les providers ;
- importe les épreuves et séances ;
- conserve les observations brutes et leur provenance ;
- normalise les données de façon déterministe ;
- publie un état canonique idempotent ;
- expose une API versionnée et un flux `/changes` ;
- planifie et borne les synchronisations ;
- protège les quotas fournisseurs, les reprises et les publications partielles.

Le serveur n’applique pas les préférences propres à MyBB ou Android.

## Architecture cible Node/PostgreSQL

```text
Provider
   │
   ▼
Provider HTTP / quota / budget
   │
   ▼
Acquisition
   │
   ├── Stream durable
   ├── Lease / run / fencing
   ├── Traversal resumable
   └── Observations source
   │
   ▼
Canonical handoff
   │
   ├── Mapping immuable lié au traversal
   ├── Normalisation déterministe
   └── Publication idempotente
   │
   ▼
API /changes
   │
   ├── Web Admin
   └── Clients externes
```

### Composants principaux

- `apps/api/src/providers/` : configuration providers, découverte, quotas, scheduler, acquisition et stockage source ;
- `apps/api/src/normalization/` : mapping versionné, normalisation, checkpoints/fencing et publication ;
- `apps/api/src/routes/` : API publique et administration ;
- `apps/api/src/worker.ts` : worker de découverte uniquement à cette baseline ;
- `apps/api/src/cli/providerAcquireOnce.ts` : exécution d’acquisition explicite et bornée ;
- `apps/web/` : console d’administration ;
- `infra/postgres/migrations/` : historique immuable du schéma PostgreSQL ;
- `monitoring/` : Prometheus/Grafana ;
- `infra/caddy/` : intégration proxy/TLS moderne de préproduction.

## Principes d’autorité

Les états ne doivent pas être interprétés comme une seule machine à états globale. Chaque niveau répond à une question différente :

```text
Provider instance autorisée ?
        ↓
Mapping provider/championnat actif ?
        ↓
Stream éligible ?
        ↓
Lease/run détenu ?
        ↓
Traversal complet ou partiel ?
        ↓
Normalisation valide ?
        ↓
Publication autorisée ?
```

Le document `docs/provider-state-model.md` définit l’autorité et les transitions de chacun de ces niveaux.

## Invariants à préserver

Les simplifications futures ne doivent pas supprimer les garanties suivantes :

- budget de requêtes vérifié avant émission HTTP ;
- quota/cadence durables ;
- leases et fencing ;
- traversal resumable distinct du run ;
- observations brutes conservées ;
- mapping de normalisation versionné et immuable pour un traversal ;
- traversal partiel non publiable ;
- normalisation déterministe ;
- publication idempotente et historique `/changes` ;
- last-known-good conservé en cas d’ambiguïté ou d’échec.

## Backend Python legacy

Le répertoire `server/` contient l’ancienne génération complète : FastAPI, SQLAlchemy, Alembic et adapters providers Python.

Il reste présent uniquement tant que le cutover production Node n’est pas terminé. Sa présence ne doit pas être interprétée comme une seconde architecture à faire évoluer.

Voir `server/LEGACY.md`.

## Clients externes

Le plugin MyBB et l’application Android sont des projets indépendants.

Ils utilisent les filtres de l’API :

- saison ;
- sports ;
- types de séances ;
- courses uniquement ;
- séances annulées ;
- périodes.

Les sprints sont classés comme courses. Sprint Qualifying reste une qualification.

## Direction de simplification après MVP

La cible est de réduire la surface conceptuelle exposée sans supprimer les protections :

```text
CLI / Scheduler
      │
      ▼
ProviderAcquisitionCoordinator
      │
      ├── Provider Gateway
      ├── Acquisition Engine
      └── Canonical Pipeline
```

Cette façade n’est pas encore une autorisation de refactorer le pipeline certifié. Elle représente la direction post-MVP, après validation du provider réel et cutover de production.
