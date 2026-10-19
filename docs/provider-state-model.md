# Provider state model

Baseline de référence : `8a603232bfec44711cfac382e4f73687dd370e53`.

Ce document définit les niveaux d’état du pipeline provider et précise **quelle table fait autorité pour quelle question**. Il ne remplace pas les contraintes PostgreSQL : celles-ci restent la source exécutable de vérité.

## 1. Règle générale

Il n’existe pas un unique `status` global.

Chaque niveau répond à une question différente :

```text
provider_instances
    « cette instance fournisseur peut-elle fonctionner ? »
          ↓
provider_championships
    « cette source peut-elle alimenter ce championnat canonique ? »
          ↓
sync_streams
    « ce flux durable est-il éligible à du travail ? »
          ↓
sync_runs
    « quelle exécution possède actuellement le lease ? »
          ↓
provider_acquisition_traversals
    « l’unité logique d’acquisition est-elle complète ? »
          ↓
normalization checkpoints / mapping binding
    « avec quelles règles et quel fence peut-on normaliser ? »
          ↓
publication_controls + public_resource_states
    « la promotion est-elle autorisée et quel état public est canonique ? »
```

Un niveau inférieur ne doit jamais contourner un niveau supérieur bloqué.

---

## 2. Provider instance — `provider_instances`

### Autorité

Autorise ou bloque l’instance technique d’un provider.

### États PostgreSQL

- `draft`
- `active`
- `paused`
- `suspended`
- `error`

L’état `active` exige `enabled=true`.

### Interprétation

- `draft` : configuration non activée ;
- `active` : instance autorisée ;
- `paused` : arrêt volontaire temporaire ;
- `suspended` : arrêt de sécurité, par exemple après erreur d’authentification ;
- `error` : état durable nécessitant intervention.

### Règle

Aucune acquisition réelle ne doit être émise si l’instance n’est pas `enabled=true AND state='active'`.

---

## 3. Mapping provider/championnat — `provider_championships`

### Autorité

Décide si une instance provider est autorisée à alimenter un championnat canonique donné.

### `sync_state`

- `inactive`
- `active`
- `paused`
- `suspended`
- `error`

### `discovery_state`

- `manual`
- `discovered`
- `configured`

### Invariant important

Un mapping `sync_state='active'` doit être `is_primary=true`.

Une seule source primaire active peut exister pour un championnat canonique.

### Règle

L’état de l’instance provider ne remplace pas celui du mapping championnat : **les deux doivent autoriser le travail**.

---

## 4. Stream durable — `sync_streams`

### Autorité

Représente la file de travail durable d’un `provider_championship`.

Chaque mapping possède au maximum un stream par phase :

- `current`
- `historical`

### États PostgreSQL

- `pending`
- `ready`
- `running`
- `waiting_quota`
- `backoff`
- `paused`
- `suspended`
- `error`
- `complete`

### Champs de coordination

- `cursor`
- `next_eligible_at`
- `failure_count`
- `last_error_code`
- `lease_owner`
- `lease_acquired_at`
- `lease_expires_at`
- `lease_generation`

### Règle

Le stream est l’autorité sur **l’éligibilité et le curseur durable**, pas sur la complétude métier d’une traversal.

`running` ne signifie donc pas « acquisition complète » ; cela signifie qu’un travail est actuellement possédé/exécuté.

---

## 5. Run / lease — `sync_runs`

### Autorité

Trace une exécution sous lease. Un run est éphémère par rapport au traversal.

### États PostgreSQL

- `running`
- `completed`
- `failed_transient`
- `failed_durable`
- `interrupted`
- `skipped_quota`

### Work classes historiques du scheduler

- `current`
- `recent_catchup`
- `deep_history`
- `discovery`

### Invariant

Un seul run `running` est autorisé par stream.

### Règle

Un run terminé ne signifie pas nécessairement que l’acquisition logique est terminée. Un budget épuisé ou une interruption peut laisser un traversal partiel à reprendre sous un run ultérieur.

---

## 6. Traversal d’acquisition — `provider_acquisition_traversals`

### Autorité

Le traversal représente **l’unité logique resumable de collecte provider**.

### États PostgreSQL

- `running`
- `complete`
- `partial`
- `failed`
- `empty_confirmed`

### Work classes

La migration durable définit notamment :

- `current_hot`
- `current_future`
- `finalization`
- `recent_catchup`
- `deep_history`

Le runtime courant possède également une sélection `current_global`; ces vocabulaires constituent une dette de simplification à traiter après MVP, sans modifier les garanties actuelles.

### Complétude

Le booléen `complete` est l’autorité primaire pour la complétude.

PostgreSQL impose :

- `complete=true` seulement avec `status in ('complete','empty_confirmed')` et `finished_at` renseigné ;
- une traversal complète est historiquement immuable.

### Règle critique

**Une traversal partielle ne peut jamais déclencher le canonical handoff.**

La pagination incomplète, un budget épuisé, une erreur ou un arrêt doivent laisser `complete=false`.

---

## 7. Relation run ↔ traversal

Ces objets ne sont pas des doublons.

```text
Stream
  │
  ├─ Run #1 ─────┐
  │              ▼
  │          Traversal V1 (partial)
  │              ▲
  └─ Run #2 ─────┘
                 │
                 ▼
             complete
```

Le run représente l’exécution/lease ; le traversal représente le travail logique persistant.

Cette distinction est nécessaire pour reprendre une pagination sous un nouveau lease sans changer son identité historique.

---

## 8. Mapping de normalisation

### Autorité

Le mapping versionné détermine les règles de traduction source → canonique.

Règles :

- nouvelle traversal : utilise le mapping actif au moment de sa création ;
- traversal resumable : utilise exclusivement son mapping déjà lié ;
- un changement ultérieur du mapping actif ne modifie jamais une traversal existante ;
- un binding traversal → mapping est immuable.

La baseline `8a603232` certifie explicitement la reprise d’une traversal liée à V1 après activation de V2.

### Conséquence

```text
Traversal ancienne -> mapping V1 pour toujours
Nouvelle traversal  -> mapping actif V2
```

---

## 9. Checkpoint et fencing de normalisation

### Autorité

Les checkpoints/fences garantissent qu’une normalisation concurrente ou obsolète ne peut pas publier sous une génération qui ne lui appartient plus.

### Règle

Le fence est une protection de concurrence, pas un état fonctionnel du provider.

Il ne doit pas être utilisé pour décider si un provider est actif ou si un stream est éligible.

---

## 10. Publication — `publication_controls`

### Autorité

Le contrôle `promotion` décide si les candidats normalisés peuvent être promus vers l’état public.

Champs principaux :

- `control_key='promotion'`
- `enabled`
- `revision`

### Règle

Le contrôle de publication est indépendant de :

- `PREVIEW_API_ENABLED` ;
- l’activation du provider ;
- la complétude du stream.

Il s’agit d’un kill switch de promotion canonique.

---

## 11. État public — `public_resource_states`

### Autorité

Décrit la version canonique actuellement publiée d’une ressource.

### Lifecycle

- `active`
- `removed`

Un tombstone `removed` est permanent.

Chaque changement public est associé à une révision et peut produire une entrée ordonnée dans `public_change_log`.

Les receipts de publication garantissent l’idempotence des candidats déjà traités.

---

## 12. Quota et backoff

Le quota est une barrière indépendante autour de l’émission HTTP.

L’autorisation provider requiert donc simultanément :

```text
provider actif
AND mapping championnat actif
AND stream éligible
AND lease valide
AND mapping de normalisation résolu
AND budget one-shot disponible
AND quota/cadence autorise l’émission
```

La baseline certifie que le budget est contrôlé **avant émission HTTP** et qu’un HTTP 200 réussi ne crée pas de `stream_backoff`.

---

## 13. Ordre d’autorité opérationnel

Pour diagnostiquer une acquisition qui ne démarre pas, vérifier dans cet ordre :

1. `provider_instances.enabled/state` ;
2. `provider_championships.sync_state/is_primary` ;
3. `sync_streams.phase/state/next_eligible_at` ;
4. lease du stream ;
5. traversal resumable éventuelle ;
6. binding de mapping de cette traversal, sinon mapping actif ;
7. quota/backoff ;
8. budget explicite du runner ;
9. seulement alors l’appel HTTP provider.

Pour diagnostiquer une acquisition terminée mais non visible publiquement :

1. traversal `complete=true` ;
2. mapping historique valide ;
3. checkpoint/fence ;
4. candidat normalisé ;
5. `publication_controls.promotion` ;
6. receipt de publication ;
7. `public_resource_states` ;
8. `public_change_log` / `/changes`.

---

## 14. Ce modèle ne doit pas être simplifié par suppression de garanties

Une future façade `ProviderAcquisitionCoordinator` pourra masquer les détails, mais ne doit pas fusionner ou éliminer conceptuellement :

- stream ;
- lease/fencing ;
- traversal resumable ;
- mapping immuable ;
- quota/budget pré-émission ;
- normalisation déterministe ;
- publication idempotente.

La simplification recherchée concerne **la surface d’API et la lisibilité**, pas les garanties de cohérence.
