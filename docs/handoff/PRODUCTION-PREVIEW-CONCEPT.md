# Production Preview — Concept consolidé

Date : 2026-08-16  
Statut : **CONCEPTION CONSOLIDÉE — IMPLÉMENTATION NON AUTORISÉE PAR CE DOCUMENT**

## 0. Objet

Ce document consolide les décisions mainteneur relatives à la stratégie **Production Preview** de Motorsports Events.

L'objectif est de permettre l'utilisation réelle de l'API par de premiers clients le plus tôt possible, sans créer d'architecture temporaire ou jetable et sans modifier la destination finale du projet.

La Production Preview accélère **l'ordre de livraison**, pas l'architecture cible.

La trajectoire finale reste :

```text
Fournisseurs
  ↓
5.6 — acquisition fournisseur durable
  ↓
stockage source rejouable
  ↓
5.7 — normalisation / mappings / corrections / présence
  ↓
modèle métier stable
  ↓
API publique /api/v1
  ↓
clients
```

La Preview introduit une tranche verticale exploitable avant la finition complète des Lots 5.8, 5.9 et 5.10.

Ce document **n'autorise pas l'implémentation du Lot 5.7**. Le gate actuel reste inchangé : seul le Lot 5.6 est autorisé en implémentation tant qu'une décision mainteneur explicite n'ouvre pas la suite.

---

# 1. Stratégie de livraison

## 1.1 Destination finale inchangée

La Preview doit utiliser les mêmes objets, identifiants, routes et contrats qui resteront dans la production finale.

Interdictions :

- pas d'API temporaire dédiée `/preview` ;
- pas de lecture client directe des tables source 5.6 ;
- pas de modèle Event parallèle ;
- pas d'identifiants jetables ;
- pas de voie de synchronisation parallèle ;
- pas de logique qui devra être supprimée après la Preview.

## 1.2 Chemin critique

```text
Corrections restantes 5.6-D
        ↓
fin minimale fiable de 5.6
        ↓
5.7-P — tranche verticale de normalisation
        ↓
API /api/v1 read-only
        ↓
auth API keys + quotas
        ↓
certification F1
        ↓
déploiement Production
        ↓
premier client
        ↓
extension progressive des championnats
        ↓
5.7 complet / 5.8 / 5.9 / 5.10
```

## 1.3 Championnat pilote

**Formula 1 / F1** est le championnat pilote de Production Preview.

Les autres championnats sont activés progressivement après certification, sans changement du contrat API.

---

# 2. Séparation des couches

## 2.1 Source 5.6 privée

Les structures suivantes restent strictement internes :

- `provider_source_entities` ;
- traversals ;
- checkpoints ;
- quotas fournisseurs ;
- anomalies d'acquisition ;
- IDs externes fournisseurs ;
- credentials ;
- graphes source ;
- détails de pagination.

Aucun client ne doit dépendre directement du stockage source 5.6.

## 2.2 Couche publique

Les clients consomment uniquement des objets métier normalisés :

- Championships ;
- Events ;
- Meetings ;
- journal public de changements.

---

# 3. Modèle métier public

## 3.1 Event-as-Session

Invariant permanent :

> **1 Event métier = 1 Session métier.**

Exemples :

```text
Dutch GP — Practice 1 = Event
Dutch GP — Qualifying = Event
Dutch GP — Race = Event
```

La Production Preview ne crée jamais un modèle métier `Event → Sessions`.

## 3.2 Meeting

Un `Meeting` est un **regroupement stable de lecture** représentant une épreuve / un week-end.

Exemple :

```text
Meeting "Dutch Grand Prix"
  ├── Event Practice 1
  ├── Event Practice 2
  ├── Event Practice 3
  ├── Event Qualifying
  └── Event Race
```

Le Meeting n'est pas une copie des Events.

La relation est portée conceptuellement par :

```text
meetings
meeting_events
```

Un Event peut appartenir à zéro ou un Meeting.

Le Meeting possède son propre UUID Motorsports Events stable.

---

# 4. Identifiants

## 4.1 UUID publics Motorsports Events

Les identifiants publics restent les UUID générés par Motorsports Events :

```text
event.id
meeting.id
championship.id
circuit.id
```

Ils sont indépendants des IDs fournisseurs.

## 4.2 Stabilité

Une modification de :

- nom ;
- horaire ;
- circuit ;
- statut ;
- sponsor ;
- fournisseur ;

ne doit pas créer automatiquement un nouvel UUID si l'identité métier est conservée.

## 4.3 Tombstones

Un UUID public retiré n'est **jamais recyclé**.

`removed` signifie :

> la ressource ne fait plus partie du dataset client.

Cela ne signifie pas que l'objet n'a jamais existé.

Une identité retirée reste réservée définitivement.

---

# 5. Ressource Championship

Objet public conceptuel :

```json
{
  "id": "uuid",
  "slug": "formula-1",
  "name": "Formula 1",
  "short_name": "F1",
  "official_name": "FIA Formula One World Championship",
  "category": "car",
  "season": 2026,
  "logo_url": null,
  "description": null,
  "availability": "preview"
}
```

## 5.1 Visibilité client

État distinct de l'état métier/interne :

```text
internal
preview
public
suspended
```

- `internal` : jamais visible client ;
- `preview` : visible aux clients autorisés Preview ;
- `public` : visible en production générale ;
- `suspended` : publication stoppée sans supprimer les données ni arrêter l'acquisition.

Acquisition et publication sont toujours distinctes.

---

# 6. Ressource Event

Contrat conceptuel :

```json
{
  "id": "uuid",
  "revision": 7,
  "slug": "dutch-grand-prix-race",
  "championship": {
    "id": "uuid",
    "slug": "formula-1",
    "name": "Formula 1",
    "short_name": "F1"
  },
  "name": "Dutch Grand Prix",
  "session": {
    "type": "race",
    "name": "Race"
  },
  "starts_at": "2026-08-30T13:00:00Z",
  "ends_at": "2026-08-30T15:00:00Z",
  "timezone": "Europe/Amsterdam",
  "status": "scheduled",
  "venue": {
    "id": "uuid",
    "name": "Circuit Zandvoort",
    "city": "Zandvoort",
    "country_code": "NL"
  },
  "description": null,
  "data_quality": {
    "freshness": "fresh"
  },
  "last_updated_at": "2026-08-16T08:21:42Z"
}
```

## 6.1 Session types

Taxonomie initiale extensible :

```text
practice
practice_1
practice_2
practice_3
qualifying
sprint_qualifying
sprint
warmup
race
test
other
```

Le type normalisé et le nom humain restent distincts.

Exemple :

```json
{
  "type": "other",
  "name": "Superpole"
}
```

## 6.2 Statuts publics

```text
scheduled
completed
cancelled
postponed
```

`draft` reste interne.

Aucun statut `live` n'est exposé tant qu'une source suffisamment fiable ne permet pas de le déterminer.

## 6.3 Dates

Règle :

```text
starts_at = UTC ISO-8601
ends_at   = UTC ISO-8601 ou null
timezone  = fuseau IANA local
```

Une estimation interne 5.6 ne devient jamais silencieusement une fin publique certaine.

Si seule une estimation existe :

```text
ends_at = null
```

## 6.4 Pays

Valeur canonique : ISO 3166-1 alpha-2.

---

# 7. Ressource Meeting

Endpoints publics prévus :

```text
GET /api/v1/meetings
GET /api/v1/meetings/{id}
```

Exemple :

```json
{
  "id": "uuid",
  "revision": 3,
  "championship": {
    "id": "uuid",
    "slug": "formula-1",
    "name": "Formula 1",
    "short_name": "F1"
  },
  "name": "Dutch Grand Prix",
  "season": 2026,
  "starts_at": "2026-08-28T10:30:00Z",
  "ends_at": "2026-08-30T15:00:00Z",
  "timezone": "Europe/Amsterdam",
  "venue": {
    "id": "uuid",
    "name": "Circuit Zandvoort",
    "city": "Zandvoort",
    "country_code": "NL"
  },
  "data_quality": {
    "freshness": "fresh",
    "completeness": "complete"
  },
  "sessions": [
    {
      "event_id": "uuid",
      "type": "practice_1",
      "name": "Practice 1",
      "starts_at": "2026-08-28T10:30:00Z",
      "ends_at": "2026-08-28T11:30:00Z",
      "status": "scheduled"
    }
  ]
}
```

`sessions[]` est une projection des Events existants, jamais une copie métier indépendante.

---

# 8. Normalisation 5.7-P

## 8.1 Objet

5.7-P est une tranche verticale minimale de 5.7 destinée à permettre la Preview, tout en restant compatible avec le Lot 5.7 complet.

Minimum nécessaire :

- source → Event ;
- source → Meeting ;
- stabilité UUID ;
- mapping championnat ;
- mapping circuit ;
- mapping session type ;
- mapping statut ;
- dates ;
- overrides ;
- idempotence ;
- replay ;
- publication gate ;
- freshness.

Peuvent attendre après Preview :

- réconciliation multi-provider complexe ;
- UX complète de mapping ;
- fusion avancée d'objets déjà publiés ;
- couverture complète de tous les championnats ;
- outils avancés de présence.

## 8.2 Liens source durables

Conceptuellement :

```text
event_source_links
meeting_source_links
```

Ils associent les entités source à leurs UUID métier stables.

Une source déjà liée ne repasse pas dans le moteur de matching à chaque synchronisation.

## 8.3 Replay

Rejouer la même source avec la même version de normalisation doit produire :

```text
même Event
même Meeting
mêmes liens
aucun doublon
```

## 8.4 Version de normalisation

Chaque normalisation doit pouvoir être attribuée à une `normalization_version`.

Une nouvelle version ne remappe jamais silencieusement les identités déjà publiées.

---

# 9. Moteur de rapprochement

## 9.1 Principe

Ordre :

```text
source déjà liée ?
  ↓ non
identité déterministe ?
  ↓ non
candidats plausibles
  ↓
incompatibilités absolues
  ↓
score contrôlé
  ↓
AUTO_MATCH / REVIEW_REQUIRED / CREATE_NEW
```

## 9.2 Règle conservatrice validée

> En cas d'ambiguïté, aucune fusion automatique.

La source passe en `review_required`.

Le championnat complet ne doit pas être bloqué par une ambiguïté isolée.

## 9.3 Event — incompatibilités fortes

Exemples :

- championnat différent ;
- saison incompatible ;
- Meeting certain différent ;
- type de session incompatible ;
- incompatibilité temporelle manifeste.

## 9.4 Meeting — incompatibilités fortes

- championnat différent ;
- saison différente ;
- round explicitement différent ;
- fenêtre temporelle manifestement incompatible.

## 9.5 Score Event initial

Signaux proposés :

```text
même Meeting certain          +35
même type normalisé           +25
horaire très proche           +20
même circuit                  +10
nom/session compatible         +5
même round                     +5
```

Horaire :

```text
<= 5 min    +20
<= 30 min   +16
<= 2 h      +10
<= 6 h       +4
> 6 h         0
```

Valeurs initiales :

```text
AUTO_MATCH >= 90
REVIEW     >= 75
marge premier/deuxième >= 15
au moins 2 signaux structurels indépendants
```

Les seuils sont configurables et versionnés.

Les règles déterministes et incompatibilités priment toujours sur le score.

## 9.6 Meeting

Signaux possibles :

- identité source stable ;
- championnat/saison ;
- round ;
- circuit ;
- fenêtre temporelle ;
- nom ;
- pays ;
- Events déjà liés en commun.

Les sessions communes déjà liées constituent une preuve très forte.

## 9.7 Pas de LLM dans le matching automatique

Un LLM ne doit jamais décider automatiquement de l'identité Event/Meeting en production.

Une IA pourra ultérieurement suggérer une résolution administrative, mais le moteur automatique reste déterministe, testable et rejouable.

---

# 10. Décisions manuelles d'identité

Le système doit pouvoir conserver durablement :

```text
source S → Event X : linked
source S ≠ Event X : rejected
```

Une décision `rejected` empêche le même candidat d'être reproposé automatiquement à chaque synchronisation.

La fusion avancée d'Events déjà existants n'est pas nécessaire au chemin critique Preview.

---

# 11. Overrides et corrections

Flux :

```text
valeur source
   ↓
normalisation
   ↓
valeur normalisée source
   ↓
override administratif éventuel
   ↓
valeur effective
```

Une synchronisation fournisseur ne détruit jamais un override actif.

Si la source rejoint ensuite la valeur d'override, le système peut signaler cette convergence mais ne supprime pas automatiquement l'override.

---

# 12. Absence et suppression

Invariant :

> **absence fournisseur ≠ suppression métier**

Même une `not_observed` confirmée ne supprime ni ne dépublie automatiquement un Event.

Une annulation explicite fiable se traduit par :

```text
status = cancelled
```

et non par disparition de l'objet.

---

# 13. Publication, qualité et last-known-good

## 13.1 Quatre notions séparées

```text
Acquisition
Normalisation
Qualité
Publication
```

Elles ne doivent jamais être confondues.

## 13.2 Sévérités internes

```text
INFO
WARNING
ERROR
CRITICAL
```

## 13.3 Plus petit périmètre de blocage

Une anomalie bloque le plus petit périmètre dont la fiabilité n'est plus garantie :

```text
Event → Meeting → Championship → API
```

Une Practice ambiguë ne doit pas couper toute la F1.

## 13.4 Last-known-good

Pour un objet déjà publié :

```text
nouvelle candidate fiable
  → promotion

nouvelle candidate douteuse
  → review_required
  → état public précédent conservé
```

Une mauvaise synchronisation ne détruit jamais instantanément une bonne donnée déjà publiée.

Pour un nouvel objet `review_required`, aucune première publication automatique.

## 13.5 Meeting quality

États internes :

```text
healthy
degraded
blocked
```

Un Meeting peut rester disponible avec certaines sessions secondaires manquantes.

## 13.6 Championship operational state

Distinct de `client_visibility` :

```text
healthy
degraded
unavailable
```

Exemple valide :

```text
client_visibility = preview
operational_state = degraded
```

## 13.7 Suspension

`degraded` peut être automatique.

`suspended` est normalement une décision forte et explicite, sauf incident de sécurité ou corruption manifeste.

## 13.8 Kill switch

Passer un championnat à :

```text
client_visibility = suspended
```

doit immédiatement arrêter sa publication client sans :

- supprimer ses données ;
- arrêter 5.6 ;
- perdre les mappings ;
- perdre l'historique.

---

# 14. Data quality public

Le client ne reçoit pas la mécanique interne.

Concept public :

```json
{
  "data_quality": {
    "freshness": "fresh",
    "completeness": "partial"
  }
}
```

## 14.1 Freshness

```text
fresh
delayed
stale
unknown
```

La fraîcheur est relative à la cadence attendue 5.5, pas à une durée universelle arbitraire.

`stale` ne signifie pas automatiquement `unpublished`.

## 14.2 Completeness

```text
complete
partial
unknown
```

`complete` n'est utilisé que lorsque la complétude peut réellement être démontrée.

---

# 15. API publique V1

Routes principales :

```text
GET /api/v1/championships
GET /api/v1/championships/{id}

GET /api/v1/events
GET /api/v1/events/{id}

GET /api/v1/meetings
GET /api/v1/meetings/{id}

GET /api/v1/changes
```

Aucun préfixe `/preview`.

## 15.1 Events — filtres

Prévoir :

```text
championship
championship_id
from
to
status
session_type
limit
cursor
```

`championship` peut utiliser un slug (`f1`).

`championship` et `championship_id` ne doivent pas être fournis simultanément.

## 15.2 Comportement par défaut

Sans `from`, la consultation Events vise par défaut le futur/current, pas tout l'historique.

## 15.3 Pagination de consultation

Pagination par curseur opaque, ordre stable :

```text
starts_at ASC
id ASC
```

Limites :

```text
default 50
max 100
```

Réponse collection :

```json
{
  "data": [],
  "pagination": {
    "next_cursor": null,
    "has_more": false
  }
}
```

## 15.4 Erreurs

Contrat :

```json
{
  "error": {
    "code": "invalid_request",
    "message": "...",
    "request_id": "req_..."
  }
}
```

Codes initiaux :

```text
invalid_request
unauthorized
forbidden
not_found
rate_limit_exceeded
daily_quota_exceeded
sync_cursor_expired
invalid_sync_cursor
service_unavailable
internal_error
```

Aucune stack, SQL, payload fournisseur ou secret n'est exposé.

---

# 16. Compatibilité `/api/v1`

Dans V1, sont autorisés sans V2 :

- ajout d'un champ optionnel ;
- ajout d'un endpoint ;
- ajout d'un filtre optionnel ;
- ajout documenté d'une valeur à un enum explicitement extensible.

Sont cassants et exigent une nouvelle version :

- suppression d'un champ ;
- renommage ;
- changement de type ;
- changement de signification ;
- rendre obligatoire un champ auparavant optionnel.

---

# 17. Synchronisation incrémentale client

## 17.1 Deux usages

Consultation : état courant.

Synchronisation : changements depuis la dernière position.

Endpoint :

```text
GET /api/v1/changes?cursor=...
```

## 17.2 Journal public monotone

Concept :

```text
public_change_log

sequence BIGINT
resource_type
resource_id
operation
changed_fields
occurred_at
```

`sequence` fournit un ordre total durable.

`updated_at` n'est pas utilisé comme curseur principal.

## 17.3 Le journal représente l'état public

Une modification interne qui ne change pas l'état client ne produit aucune entrée publique.

Exemple : candidate ambiguë + last-known-good conservé = aucun changement client.

## 17.4 Operations

```text
created
updated
removed
availability_changed
```

Une annulation est un `updated` de `status`, pas un `removed`.

## 17.5 Atomicité

La promotion d'un état public et son entrée `public_change_log` appartiennent à la même transaction.

Invariant :

```text
public state + public_change_log = même commit
```

## 17.6 At-least-once

Le système assume une livraison incrémentale idempotente au moins une fois.

Un client peut revoir une même séquence après un crash réseau et doit pouvoir l'ignorer.

## 17.7 Revision

Chaque ressource publique Event/Meeting possède un `revision` monotone par ressource.

- `revision` : version de la ressource ;
- `sequence` : position globale dans le journal public.

## 17.8 Pagination changes

```text
default 100
max 500
```

## 17.9 Include data

Par défaut, `/changes` peut être léger.

Une option :

```text
include=data
```

peut inclure l'état courant de la ressource afin de permettre une synchronisation en un appel.

Pour `removed` :

```text
current = null
```

## 17.10 Snapshot initial cohérent

Le premier chargement doit établir une frontière de snapshot cohérente.

Les curseurs de pagination de liste et de synchronisation sont deux concepts distincts.

```text
page_cursor != sync_cursor
```

À la fin du snapshot, le client reçoit un sync cursor correspondant à la frontière.

## 17.11 Rétention

Rétention initiale proposée : 90 jours configurable.

Un cursor trop ancien retourne :

```text
HTTP 410
sync_cursor_expired
```

Le client effectue alors un full resync.

## 17.12 Scope et permissions

Le cursor représente un état, jamais une autorisation.

Les permissions du client sont toujours réévaluées au moment de chaque requête.

---

# 18. Authentification clients

## 18.1 Identité

Entité indépendante des administrateurs :

```text
api_clients

id
name
status
created_at
updated_at
```

Status :

```text
active
suspended
closed
```

## 18.2 Plusieurs clés

Concept :

```text
api_keys

id
client_id
environment
name
prefix
key_hash
status
created_at
expires_at
last_used_at
revoked_at
```

Un client peut avoir plusieurs clés actives afin de permettre une rotation sans coupure.

## 18.3 Format

```text
mse_test_...
mse_live_...
```

## 18.4 Stockage

La clé complète est montrée une seule fois.

Elle n'est jamais stockée en clair.

Solution recommandée : HMAC-SHA-256 avec pepper serveur secret et comparaison constant-time.

Le pepper reste hors PostgreSQL et hors Git.

## 18.5 Rotation / révocation

Rotation : deux clés actives temporairement.

Révocation : immédiate.

Clé perdue : nouvelle clé, jamais récupération de l'ancienne.

---

# 19. Scopes et droits dataset

## 19.1 Scopes fonctionnels

Initialement :

```text
championships:read
events:read
meetings:read
changes:read
```

## 19.2 Droits championnat séparés

Les championnats ne sont pas encodés dans les scopes.

Concept :

```text
api_client_championships
```

Cela permet d'autoriser F1 sans créer `events:f1:read`.

## 19.3 Premier client Preview

```text
environment = live
scopes = championships/events/meetings/changes read
championships = F1
```

## 19.4 Accès interdit

Filtre explicite vers un championnat non autorisé : `403`.

Accès individuel à un UUID hors droit : `404`, afin de ne pas révéler son existence.

Scope manquant : `403 insufficient_scope`.

---

# 20. Rate limiting et quotas clients

## 20.1 Deux mécanismes

Rate limit = protection rafale.

Quota journalier = consommation globale.

Valeurs Preview initiales :

```text
60 requêtes / minute / client
10 000 requêtes / jour / client
```

Configurables.

Le rate limit principal s'applique au `client_id`, pas uniquement à la clé.

## 20.2 Reset journalier

00:00 UTC.

## 20.3 Headers

```text
RateLimit-Limit
RateLimit-Remaining
RateLimit-Reset
Retry-After
```

## 20.4 Comptage

`304` compte pour le rate limit et, par simplicité Preview, pour le quota journalier.

Les `5xx` ne doivent pas être facturés au quota journalier client.

Les appels non authentifiés / interdits restent couverts par les protections anti-abus.

---

# 21. Observabilité API client

Chaque requête reçoit un `request_id` renvoyé au client.

Logs autorisés :

```text
request_id
client_id
key_id
key_prefix
endpoint
status_code
duration
championship_id si pertinent
```

Interdit :

- Authorization ;
- API key complète ;
- secret ;
- credential fournisseur.

---

# 22. Gestion ACP minimale Preview

Avant le premier client, l'ACP doit seulement permettre :

Clients :

- créer ;
- suspendre ;
- réactiver.

Clés :

- générer ;
- afficher une seule fois ;
- révoquer.

Accès :

- attribuer F1.

Limites :

- requêtes/minute ;
- requêtes/jour.

Sont hors chemin critique :

- self-service ;
- facturation ;
- Stripe ;
- portail développeur complet ;
- récupération de mot de passe client ;
- plans commerciaux complets.

Le premier client est créé manuellement depuis l'ACP.

---

# 23. Infrastructure Production Preview

## 23.1 Environnements

```text
LOCAL
STAGING
PRODUCTION
```

La Preview est un état fonctionnel de PRODUCTION, pas un quatrième environnement.

Exemple :

```text
PRODUCTION
  F1 = preview
  MotoGP = internal
  WRC = internal
```

## 23.2 Domaines cibles

```text
api.motorsports-events.fr
admin.motorsports-events.fr
motorsports-events.fr
```

Staging séparé :

```text
api.staging.motorsports-events.fr
```

## 23.3 Conteneurs

Approche Docker Compose suffisante :

```text
reverse-proxy
api
worker
postgres
```

Redis éventuel uniquement si réellement nécessaire.

Pas de Kubernetes avant besoin démontré.

## 23.4 API / worker séparés

Les appels fournisseurs et traitements lourds sont exécutés par les workers, pas par les processus servant les clients.

## 23.5 PostgreSQL

Peut rester sur le VPS au démarrage avec volume persistant et sauvegarde externe.

Le port PostgreSQL n'est jamais exposé publiquement.

## 23.6 TLS

HTTPS obligatoire.

Seuls 80/443 sont nécessaires publiquement pour le trafic web/API.

Aucune clé Bearer ne doit transiter en HTTP.

## 23.7 Secrets

Hors Git :

- DB password ;
- API key pepper ;
- provider credentials ;
- secrets admin ;
- tout credential production.

---

# 24. Déploiement

## 24.1 Migrations

Le démarrage applicatif ne doit pas muter opportunistement le schéma.

Pipeline :

```text
build
tests
backup
migration check
apply migrations
start
readiness
```

Approche préférée : `expand → migrate → contract` afin de maintenir la compatibilité pendant les déploiements.

## 24.2 Version runtime

Chaque build expose de manière non sensible :

```text
APP_VERSION
GIT_SHA
BUILD_TIME
```

## 24.3 Liveness / readiness

```text
GET /health/live
GET /health/ready
```

Liveness : processus vivant.

Readiness : application capable de servir les clients et DB/migrations compatibles.

La panne d'un fournisseur ne rend pas automatiquement l'API `unready` si le last-known-good reste disponible.

## 24.4 Déploiement sans coupure

Approche blue/green légère recommandée :

```text
api-blue
api-green
```

La nouvelle instance reçoit le trafic uniquement après readiness PASS.

## 24.5 Workers

Les workers sont basculés séparément, avec leases/fencing empêchant les doubles traitements.

## 24.6 Rollback

Rollback applicatif rapide vers la release précédente.

Le rollback code ne doit pas nécessiter normalement de rollback destructif de DB.

La séquence du journal public ne doit jamais revenir en arrière.

---

# 25. Sauvegardes

Minimum Preview :

- backup PostgreSQL quotidien ;
- backup avant migration importante ;
- copie externe au VPS ;
- chiffrement ;
- test réel de restauration.

Rétention initiale proposée :

```text
7 quotidiens
4 hebdomadaires
3 mensuels
```

Une sauvegarde n'est considérée utile qu'après test de restauration réussi.

---

# 26. Monitoring et alertes

Minimum :

- disponibilité API ;
- latence ;
- 5xx ;
- 429 ;
- PostgreSQL ;
- espace disque ;
- workers ;
- échecs acquisition ;
- échecs normalisation ;
- `review_required` ;
- état F1 ;
- sauvegardes.

Classification proposée :

```text
P1 : API/DB indisponible, corruption, secret compromis
P2 : F1 unavailable, current cassé, Race current-hot ambiguë, backup échoué
P3 : Meeting dégradé, Practice review_required, provider delayed, quota proche
```

---

# 27. Health public / interne

Les détails d'infrastructure ne sont pas exposés publiquement.

Le public reçoit un statut minimal.

Les états détaillés DB/providers/workers/normalisation restent derrière l'administration.

---

# 28. OpenAPI

OpenAPI est contractuelle, pas seulement documentaire.

Elle couvre :

- auth ;
- championships ;
- events ;
- meetings ;
- changes ;
- pagination ;
- sync ;
- erreurs ;
- rate limits.

Les tests doivent vérifier la compatibilité implémentation ↔ contrat OpenAPI.

---

# 29. CORS et clients

Pas de `Access-Control-Allow-Origin: *` par défaut.

Pour la Preview, privilégier la consommation backend-to-backend.

Une clé API statique intégrée dans du JavaScript navigateur n'est pas considérée sûre.

---

# 30. Gate de certification F1 Preview

F1 peut passer `internal → preview` seulement si :

```text
✓ acquisition current stable
✓ normalisation déterministe
✓ Meetings déterministes
✓ Events déterministes
✓ UUID stables
✓ aucune anomalie CRITICAL active
✓ aucune Race ambiguë active dans current-hot
✓ aucune duplication Event connue
✓ UTC / timezone validés
✓ overrides protégés
✓ API contract PASS
✓ auth API key PASS
✓ entitlement F1 PASS
✓ rate limiting PASS
✓ sync incremental PASS
✓ last-known-good PASS
✓ publication granulaire PASS
✓ kill switch PASS
✓ backup PASS
✓ restore PASS
✓ readiness PASS
```

L'historique complet n'est **pas** une précondition au lancement Preview.

Une anomalie historique secondaire n'empêche pas la Preview si le périmètre current fiable reste certifié.

---

# 31. Test de bout en bout pilote

Scénario F1 de référence :

```text
OCBlackTop
↓
5.6 collecte une épreuve réelle
↓
5.7-P crée / retrouve 1 Meeting
↓
5.7-P crée / retrouve N Events
↓
aucun doublon
↓
resynchronisation
↓
mêmes UUID
↓
modification horaire fournisseur
↓
mêmes UUID + horaire mis à jour
↓
override manuel
↓
resynchronisation
↓
override conservé
↓
/public_change_log atomique
↓
GET /api/v1/meetings/{id}
↓
GET /api/v1/events
↓
GET /api/v1/changes
↓
client applique la modification incrémentale
```

---

# 32. Smoke tests Production

Après chaque déploiement :

```text
/health/live                         200
/health/ready                        200
/api/v1/events sans clé              401
clé invalide                         401
clé Preview F1 /championships        F1 seulement
/events?championship=f1              données
/meetings                            données
/changes                             cursor valide
```

Un test contrôlé doit également prouver :

```text
snapshot
→ modification Event
→ public_change_log
→ /changes
→ revision +1
```

---

# 33. Pré-1970

Aucune couche ne doit imposer :

```text
timestamp > 0
```

comme test de validité.

API, normalisation, DB, sauvegardes et restauration doivent rester compatibles avec les dates antérieures à 1970.

Unix epoch `0` n'est jamais utilisé comme sentinelle d'absence de date.

---

# 34. Principes de gouvernance

1. Production Preview ne modifie pas l'architecture finale.
2. Les objets publics restent les objets définitifs V1.
3. Les tables source 5.6 restent privées.
4. La Preview ne contourne aucun invariant 5.4/5.5/5.6.
5. 5.7-P est une tranche de conception de 5.7, pas un Lot parallèle.
6. Ce document ne change pas `authorized_sub_lot`.
7. Ce document ne positionne pas `maintainer_validated=true` pour le Lot 5.6.
8. Ce document n'autorise pas une fusion dans `main`.
9. Ce document n'autorise pas l'implémentation du Lot 5.7.
10. L'ouverture de 5.7-P nécessitera une décision mainteneur explicite après le gate 5.6 requis.

---

# 35. Décisions consolidées

Les décisions suivantes sont considérées validées en conception :

- stratégie Production Preview verticale ;
- destination finale inchangée ;
- F1 championnat pilote ;
- `/api/v1` utilisé directement ;
- Event-as-Session maintenu ;
- ressource Meeting de regroupement de lecture ;
- UUID Motorsports Events stables ;
- tombstones permanents ;
- aucune fusion automatique ambiguë ;
- `review_required` granulaire ;
- matching déterministe puis scoring contrôlé ;
- last-known-good pour objets déjà publiés ;
- blocage au plus petit périmètre fiable ;
- publication séparée de l'acquisition ;
- freshness relative à la cadence ;
- API read-only Preview ;
- pagination par cursor ;
- snapshot et sync cursor distincts ;
- journal public monotone ;
- revisions par ressource ;
- synchronisation at-least-once ;
- `removed` sans réutilisation d'identité ;
- API clients via Bearer API key ;
- plusieurs clés et rotation ;
- secrets jamais stockés en clair ;
- scopes fonctionnels séparés des droits championnat ;
- rate limit par client ;
- premier client créé manuellement depuis l'ACP ;
- Production réelle avec visibilité `preview` ;
- staging séparé ;
- API et worker séparés ;
- PostgreSQL persistant ;
- TLS obligatoire ;
- secrets hors Git ;
- déploiement compatible rollback ;
- sauvegarde externe et restauration testée ;
- OpenAPI contractuelle ;
- aucun LLM dans la décision automatique d'identité.

---

# 36. Prochaine étape documentaire

La prochaine étape est la rédaction de :

```text
docs/handoff/PRODUCTION-PREVIEW-ACCEPTANCE.md
```

avec critères numérotés, preuves exigées et scénarios de recette.

Aucun code ne doit être autorisé sur la seule base du présent document.
