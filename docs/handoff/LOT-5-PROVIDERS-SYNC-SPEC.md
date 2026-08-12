# Lot 5 — Spécification Fournisseurs et moteur de synchronisation

Date : 2026-08-12

Statut : `phase-0-specification-complete-awaiting-maintainer-validation`

Implémentation : **0 %**

## 1. Portée et autorité

Cette spécification traduit le concept validé dans
`LOT-5-PROVIDERS-SYNC-CONCEPT.md`, corrigé en priorité par
`LOT-5-PROVIDERS-SYNC-ERRATA.md`. Elle ne crée aucune implémentation et doit
être validée explicitement avant le sous-lot 5.1.

Le Lot 5 fournit une administration des instances fournisseur et un moteur
persistant capable de synchroniser les Événements, qui représentent directement
les Sessions métier conformément à l'ADR-0013. Les tables et routes Sessions du
Lot 4.3 restent uniquement compatibles et ne deviennent pas la cible du moteur.

### Non-objectifs V1

- aucune fusion multisource ni priorité entre fournisseurs ;
- aucune suppression automatique d'Événement absent ;
- aucune fréquence arbitraire configurée par l'administrateur ;
- aucun contournement de quota par une commande manuelle ;
- aucune notification externe obligatoire ;
- aucun adaptateur ou fournisseur WRC autonome ;
- aucun endpoint universel imposé à une instance fournisseur.

## 2. Architecture normative

```text
ProviderAdapter (code, enregistré par adapter_key)
  -> ProviderInstance (configuration commune, secrets, quotas)
    -> ProviderChampionship (lien avec le championnat métier)
      -> adapter_source_config (opaque au moteur générique)
      -> SyncStream current (état, saison, curseur, lease)
      -> SyncStream historical (état, saison, curseur, lease)
        -> work unit définie par l'adaptateur
          -> normalisation
            -> mapping / identité / hash
              -> Event source value + corrections existantes
```

Le moteur générique ne branche jamais sur le nom d'un championnat. Il connaît
les états, budgets, leases et contrats, mais n'interprète ni endpoint, ni slug,
ni `league_id`, ni pagination. Seul l'adaptateur interprète sa configuration
fournisseur et sa configuration de source par championnat.

Un seul `ProviderChampionship` principal peut être actif pour un championnat
métier en V1. Le schéma conserve néanmoins l'identité du lien afin qu'une
évolution multisource ne nécessite pas de déplacer les données de flux.

## 3. Modèle PostgreSQL proposé

Tous les identifiants nouveaux sont des UUID générés par le serveur. Les
horodatages sont `timestamptz` UTC. Les objets JSON sont validés par l'adaptateur
avant écriture ; PostgreSQL assure uniquement leur nature objet et leur taille
maximale au niveau applicatif.

### 3.1 `provider_instances`

| Colonne | Type | Règle |
|---|---|---|
| `id` | uuid PK | identité interne |
| `adapter_key` | text | adaptateur enregistré, immuable après activation |
| `name` | text | libellé administrable unique |
| `enabled` | boolean | autorise le fournisseur |
| `state` | text | `draft`, `active`, `paused`, `suspended`, `error` |
| `config` | jsonb | configuration commune non secrète, validée par l'adaptateur |
| `max_concurrency` | integer | défaut 1, strictement positif |
| `current_year_reserve_percent` | numeric(5,2) | défaut 30, entre 0 et 100 |
| `missing_cycles_threshold` | integer | défaut 3, strictement positif |
| `log_retention_days` | integer | défaut 30 |
| `created_at`, `updated_at` | timestamptz | audit technique |

Index/contraintes : unicité insensible à la casse de `name`, index
`(state, enabled)`, contrôle `jsonb_typeof(config)='object'`.

### 3.2 `provider_secrets`

| Colonne | Type | Règle |
|---|---|---|
| `id` | uuid PK | identité |
| `provider_instance_id` | uuid FK | cascade avec l'instance |
| `secret_name` | text | nom logique défini par l'adaptateur |
| `ciphertext` | bytea | texte chiffré et tag authentifié |
| `nonce` | bytea | nonce unique par écriture |
| `key_version` | integer | version de clé maître |
| `algorithm` | text | V1 : `aes-256-gcm` |
| `created_at`, `updated_at` | timestamptz | technique |

Unicité `(provider_instance_id, secret_name)` et `(key_version, nonce)`. La clé
maître n'est jamais stockée en base. L'API ne retourne que
`{name, configured, updated_at}`. Une écriture remplace atomiquement le secret.
Les anciennes versions de clé restent lisibles pendant une rotation future.

### 3.3 `provider_championships`

Lien entre une instance et `championships(id)`.

| Colonne | Type | Règle |
|---|---|---|
| `id` | uuid PK | identité du lien |
| `provider_instance_id` | uuid FK | fournisseur |
| `championship_id` | text FK | championnat métier |
| `external_championship_id` | text nullable | identité fournisseur |
| `discovery_state` | text | `manual`, `discovered`, `configured` |
| `sync_state` | text | `inactive`, `active`, `paused`, `suspended`, `error` |
| `is_primary` | boolean | source principale V1 |
| `start_year` | integer nullable | profondeur forcée incluse |
| `discovered_at`, `activated_at`, `deactivated_at` | timestamptz nullable | cycle de vie |
| `created_at`, `updated_at` | timestamptz | technique |

Contraintes : unicité `(provider_instance_id, championship_id)`, index unique
partiel sur `championship_id where is_primary and sync_state='active'`, et
`start_year` bornée. La découverte crée le lien en `discovered/inactive` et ne
crée aucun travail actif. L'activation est une transaction explicite.

### 3.4 `provider_championship_source_configs`

| Colonne | Type | Règle |
|---|---|---|
| `provider_championship_id` | uuid PK/FK | un document courant par lien |
| `schema_version` | integer | version du schéma de l'adaptateur |
| `config` | jsonb | objet opaque au moteur |
| `validated_at` | timestamptz nullable | dernier succès de validation |
| `created_at`, `updated_at` | timestamptz | technique |

Le moteur stocke et restitue ce document sans le décoder. L'adaptateur en assure
le schéma, la validation et l'interprétation. Deux championnats d'une même
instance peuvent ainsi avoir endpoints, slugs, IDs et stratégies différents.

Exemples non contractuels :

```json
{"strategy":"ocblacktop-standard","slug":"formula1","events_path":"/v1/formula1/events"}
{"strategy":"ocblacktop-season-path","slug":"wrc","events_path_template":"/v1/wrc/{season}/events"}
{"strategy":"thesportsdb-league","league_id":"4370"}
```

### 3.5 `sync_streams`

Un lien actif possède au plus un flux `current` et un flux `historical`.

| Colonne | Type | Règle |
|---|---|---|
| `id` | uuid PK | identité |
| `provider_championship_id` | uuid FK | lien source |
| `phase` | text | `current` ou `historical` |
| `state` | text | `pending`, `ready`, `running`, `waiting_quota`, `backoff`, `paused`, `suspended`, `complete` |
| `season` | integer nullable | saison de l'unité courante |
| `cursor` | jsonb nullable | curseur sérialisé opaque |
| `cursor_version` | integer | version de sérialisation |
| `last_progress_at` | timestamptz nullable | dernière progression durable |
| `next_eligible_at` | timestamptz nullable | cadence/backoff |
| `priority_boost_until` | timestamptz nullable | commande manuelle, sans bypass quota |
| `complete_cycle_number` | bigint | cycles complets année courante |
| `lease_owner` | text nullable | worker |
| `lease_acquired_at`, `lease_expires_at` | timestamptz nullable | lease |
| `lock_version` | bigint | verrou optimiste complémentaire |
| `last_error_code` | text nullable | code expurgé |
| `created_at`, `updated_at` | timestamptz | technique |

Unicité `(provider_championship_id, phase)`. Une acquisition utilise
`FOR UPDATE SKIP LOCKED`, écrit un lease borné et ne dépasse ni concurrence ni
budget fournisseur. Une reprise récupère les leases expirés et repart du
dernier curseur commité. Curseur et résultats de l'unité de travail sont
validés dans la même transaction avant progression.

### 3.6 `sync_runs`

Une ligne durable par exécution d'une unité de travail : fournisseur, lien,
flux, phase, saison, statut, timestamps, `cursor_before`, `cursor_after`,
`requests_count`, `items_read`, `items_created`, `items_updated`,
`items_unchanged`, `corrections_preserved`, `warnings_count`, `errors_count`,
`quota_used`, `request_id`, `worker_id` et résumé d'erreur expurgé.

Statuts : `running`, `completed`, `completed_with_warnings`, `failed_transient`,
`failed_durable`, `interrupted`, `skipped_quota`. Un run abandonné est marqué
`interrupted` lors de la récupération du lease ; il n'est jamais effacé.

### 3.7 `provider_quota_policies` et `provider_quota_state`

La policy versionne les contraintes configurées par instance : fenêtre courte,
limite courte, fenêtre mensuelle, limite mensuelle, origine des limites
(`configured`, `provider_headers`, `hybrid`) et fuseau/instant de reset explicite.

L'état courant stocke séparément : consommation interne, consommation observée,
reste observé, resets observés, date de dernière observation et version. Les
valeurs observées fiables priment pour la décision sans écraser les limites
configurées. Une absence de limite sûre place les flux automatiques en
`waiting_quota_unknown`.

### 3.8 `provider_mappings`

| Colonne | Usage |
|---|---|
| fournisseur + `entity_type` + `external_id` | identité source stable |
| `normalized_key` | clé métier de repli |
| `target_type`, `target_id` | référence MEDS |
| `status` | `confirmed`, `pending`, `rejected` |
| `confidence`, `confirmed_by`, `confirmed_at` | décision explicable |

Deux mappings confirmés incompatibles sont refusés. Une ambiguïté crée un
mapping `pending` et une alerte, sans fusion silencieuse.

### 3.9 Identité fournisseur des Événements

La V1 remplace progressivement l'identité texte globale
`events(provider_key, external_id)` par :

- `events.provider_championship_id uuid null` ;
- `events.normalized_provider_hash text null` ;
- identité unique partielle `(provider_championship_id, external_id)`.

Les colonnes historiques sont conservées pendant le Lot 5 pour compatibilité.
L'ingestion remplit les deux représentations tant que les anciens contrats les
lisent. Le hash porte la représentation normalisée **source**, jamais la valeur
effective incluant les overrides.

### 3.10 `provider_event_presence`

État par Événement fournisseur : dernier cycle complet vu, nombre d'absences
consécutives, date du premier manque et état `present`/`missing`. Seule la fin
confirmée d'un cycle complet incrémente l'absence. Au seuil configuré, une
alerte est créée ; aucune suppression ni annulation implicite n'a lieu.

### 3.11 `admin_alerts`

Alertes persistantes et dédupliquées par `deduplication_key` : type, sévérité,
instance/lien/flux/ressource associés, état `open`, `acknowledged`, `resolved`,
message métier sans secret, payload expurgé et timestamps. Types minimaux :
auth invalide, quota critique/épuisé/inconnu, suspension, découverte, mapping,
événement absent, blocage et erreurs répétées.

### 3.12 Logos et logs

Le logo appartient à `championships`, jamais au lien fournisseur. Le modèle
proposé remplace l'URL libre par des métadonnées d'asset (`logo_asset_id`) sans
supprimer immédiatement `logo_url`. Le pipeline doit vérifier le MIME réel,
refuser le contenu actif, générer un nom serveur, limiter taille et dimensions
et servir l'asset depuis un répertoire dédié. Formats V1 proposés : PNG, JPEG et
WebP ; SVG reporté tant qu'une désinfection robuste n'est pas définie. Limites à
valider au sous-lot UI : 2 Mio, 2048 x 2048, sans agrandissement.

Les logs techniques restent JSON sur stdout/stderr. Une persistance volume est
optionnelle, avec rotation quotidienne **ou** à 100 Mio (premier seuil),
compression et rétention 30 jours. L'administration lit uniquement un service
borné et expurgé ; elle ne reçoit jamais un chemin arbitraire.

## 4. Contrat TypeScript proposé des adaptateurs

```ts
type JsonObject = Record<string, unknown>;

interface FieldSchema {
  key: string;
  label: string;
  type: 'text' | 'url' | 'integer' | 'boolean' | 'select' | 'secret';
  required: boolean;
  secret?: boolean;
  options?: Array<{ value: string; label: string }>;
  help?: string;
}

interface ProviderAdapter<Cfg extends JsonObject, SourceCfg extends JsonObject,
  Cursor extends JsonObject, Raw, Normalized> {
  readonly key: string;
  readonly providerConfigVersion: number;
  readonly sourceConfigVersion: number;
  readonly cursorVersion: number;

  providerForm(): readonly FieldSchema[];
  championshipForm(context: { providerConfig: Cfg }): readonly FieldSchema[];
  validateProviderConfig(value: unknown): Cfg;
  validateSourceConfig(value: unknown, context: { providerConfig: Cfg }): SourceCfg;
  testConnection(context: AdapterContext<Cfg>): Promise<ConnectionResult>;

  discoverChampionships?(context: AdapterContext<Cfg>):
    AsyncIterable<DiscoveredChampionship<SourceCfg>>;
  discoverSeasons?(context: StreamContext<Cfg, SourceCfg>):
    Promise<SeasonDiscoveryResult>;

  initialCursor(input: WorkSelection<Cfg, SourceCfg>): Cursor;
  serializeCursor(cursor: Cursor): JsonObject;
  restoreCursor(value: unknown, version: number): Cursor;
  fetchWorkUnit(input: FetchWorkUnitInput<Cfg, SourceCfg, Cursor>):
    Promise<FetchWorkUnitResult<Raw, Cursor>>;

  observeQuota(response: ProviderResponseMetadata): QuotaObservation | null;
  normalize(raw: Raw, context: NormalizationContext):
    NormalizationResult<Normalized>;
  confirmEmptySeason(input: EmptySeasonEvidence<Cursor>):
    Promise<EmptySeasonDecision>;
}
```

`FetchWorkUnitResult` distingue obligatoirement `progress`, `end_of_cycle`,
`confirmed_empty_season`, `transient_failure` et `durable_failure`. Une page
vide intermédiaire ne peut donc pas devenir implicitement une fin de saison.
Le contexte fournit un client HTTP instrumenté et redigé ; l'adaptateur ne lit
pas directement les secrets persistés ni ne journalise les en-têtes.

## 5. Stratégies connues

### OCBlackTop

Une instance partage secret, quotas, compteurs et concurrence. Chaque lien
championnat choisit une stratégie enregistrée dans l'adaptateur. Les stratégies
standard et saison-paramétrée peuvent utiliser des chemins et curseurs distincts.

WRC utilise l'adaptateur OCBlackTop et une configuration de source appropriée.
Il possède ses propres flux, saison, curseurs, cycles et leases. Aucun
`if championship === 'WRC'` n'existe dans le scheduler générique ; si une
spécialisation interne est nécessaire, l'adaptateur sélectionne une stratégie
par la valeur validée de `source_config.strategy`.

### TheSportsDB

Son schéma de championnat expose notamment l'identifiant réel de ligue
(`league_id`) et ses propres règles de saisons/pagination. Il ne réutilise pas
le formulaire OCBlackTop.

### Futurs adaptateurs

Un nouvel adaptateur est enregistré dans le code et apporte ses schémas,
stratégies, normalisation et tests de contrat. Une nouvelle instance d'un
adaptateur existant ne demande aucun code.

## 6. Scheduler, bootstrap et historique

### Activation atomique

1. valider instance, secret, source config et quota sûr ;
2. garantir l'unique source principale active ;
3. activer le lien ;
4. créer/réinitialiser le flux `current` en priorité haute ;
5. créer le flux `historical` en attente ;
6. auditer l'opération dans la même transaction.

### Ordonnancement

Le dispatcher choisit d'abord les unités `current` éligibles, en round-robin
par instance et lien. Chaque championnat actif reçoit un premier passage de
l'année courante avant qu'un travail historique ne soit éligible. Ensuite, le
budget non réservé alterne les flux historiques sans affamer `current`.

Le flux historique utilise les saisons découvertes ; sinon il descend de N-1
jusqu'à une saison vide confirmée, sauf `start_year` qui fixe la borne incluse
et permet de traverser une année vide connue selon la décision de l'adaptateur.

Le flux courant parcourt du 1er janvier à la fin confirmée, incrémente son cycle,
réinitialise son curseur initial et recommence. Chaque succès commite données,
présence, quota, run et curseur ensemble.

### Cadence

Pour chaque fenêtre connue :

```text
budget_utilisable = max(0, limite_sûre - consommation_observée - marge)
cadence_minimale = temps_avant_reset / max(1, budget_utilisable)
```

Le délai retenu est le maximum des cadences imposées par toutes les fenêtres,
augmenté d'un jitter borné. Le budget mensuel historique vaut au plus le reste
hors réserve `current`. La répartition se fait entre flux éligibles par
round-robin pondéré uniquement par phase, jamais par volume déjà consommé.
Le calcul est refait après observation de headers, appel, reset, changement de
configuration, activation ou suspension. Une limite absente n'est pas
interprétée comme illimitée.

### Erreurs et reprise

- 429, timeout, DNS, réseau, 5xx : backoff exponentiel plafonné + jitter,
  `Retry-After` prioritaire lorsqu'il est sûr ;
- 401/403/secret ou config durablement invalide : suspension ciblée et alerte ;
- lease expiré : run `interrupted`, lease récupéré, curseur durable restauré ;
- pause : aucun nouveau lease, unité déjà engagée finit ou expire proprement ;
- synchroniser maintenant : `priority_boost_until`, toujours soumis au budget ;
- reset curseur : confirmation forte, transaction, audit et nouveau run ; les
  données métier ne sont pas supprimées.

## 7. Normalisation, idempotence et corrections

1. l'adaptateur produit un objet normalisé UTC ;
2. un mapping confirmé résout les références ;
3. sinon `external_id` stable résout l'identité ;
4. sinon une clé métier normalisée sûre peut résoudre ;
5. toute ambiguïté crée `pending` + alerte et n'écrit pas de fusion ;
6. un hash canonique identique classe l'élément `unchanged` ;
7. un changement appelle le service transactionnel de corrections existant :
   source mise à jour, override conservé, valeur effective locale ;
8. l'audit n'est écrit que pour une mutation réelle.

La présence est évaluée seulement après un cycle complet confirmé. Une
annulation explicite est un statut fournisseur normal, distinct d'une absence.

## 8. Contrats API administration proposés

Toutes les routes ci-dessous sont sous `/api/v1/admin`, acceptent la session
humaine ou le HMAC technique existants, appliquent CSRF aux mutations cookie,
valident par schéma strict, auditent les mutations et ne retournent aucun secret.

### Instances et schémas

- `GET /provider-adapters` : adaptateurs et schémas de formulaire ;
- `GET /providers`, `POST /providers` ;
- `GET /providers/:id`, `PATCH /providers/:id` ;
- `PUT /providers/:id/secrets/:name`, `DELETE ...` ;
- `POST /providers/:id/test-connection` ;
- `POST /providers/:id/discover-championships` ;
- `GET /providers/:id/championships`.

### Liens championnats et source config

- `POST /providers/:id/championships` : ajout manuel inactif ;
- `GET/PATCH /provider-championships/:id` ;
- `PUT /provider-championships/:id/source-config` ;
- `POST /provider-championships/:id/test-source` ;
- `POST /provider-championships/:id/activate` ;
- `POST /provider-championships/:id/deactivate`.

### Quotas, scheduler et historique

- `GET/PUT /providers/:id/quota-policy` ;
- `GET /providers/:id/quota-state` ;
- `GET /providers/:id/sync-state` ;
- `POST /providers/:id/sync-now` ;
- `POST /provider-championships/:id/sync-now` ;
- `POST /provider-championships/:id/pause|resume` ;
- `POST /sync-streams/:id/reset-cursor` avec confirmation explicite ;
- `GET /providers/:id/sync-runs` et `GET /sync-runs/:id` ;
- `GET /providers/:id/logs` borné, filtré et paginé ;
- `GET /alerts`, `POST /alerts/:id/acknowledge|resolve`.

### Mappings et logos

- `GET /provider-mappings`, `POST /provider-mappings/:id/resolve` ;
- `POST /championships/:id/logo`, `DELETE /championships/:id/logo`.

Les listes paginent, filtrent et trient côté SQL avant découpage, conformément
à l'ADR-0011. Les réponses d'erreur utilisent des codes stables et des messages
expurgés ; les payloads JSON d'adaptateur ne sont jamais renvoyés sans filtrage.

## 9. Impact API publique

Le contrat public Événements reste inchangé. Les requêtes joignent déjà
`championships` et imposent `c.active=true`. La désactivation métier existante
peut donc exclure dynamiquement les Événements sans les réécrire.

Le Lot 5 doit toutefois séparer deux notions : visibilité métier
`championships.active` et activation de synchronisation du lien. Désactiver un
flux arrête seulement la synchronisation ; désactiver le championnat métier
exclut l'API publique. L'action UI « Désactiver le championnat » réalise les
deux explicitement dans une transaction, tandis qu'une simple pause fournisseur
ne masque pas les données publiques.

Les métadonnées instance, source config, curseur, quota, hash, mapping, absence
et alerte ne sont jamais ajoutées à `/api/v1` public.

## 10. Plan de migrations proposé (aucun SQL créé en Phase 0)

### M1 — Socle fournisseurs

UP : créer instances, secrets, policies/états de quota et contraintes.
DOWN : refuser si instances/secrets existent, puis retirer les objets.

### M2 — Liens et configurations de source

UP : créer liens et source configs ; convertir de façon conservatrice les
`championships.provider_key` non nuls en instances/lien `inactive` identifiables,
sans activer de synchronisation automatique. Conserver les colonnes historiques.
DOWN : refuser si un lien a été modifié/activé après migration ; sinon retirer
les liens migrés et les tables sans toucher aux colonnes historiques.

### M3 — Flux, quotas runtime et runs

UP : créer `sync_streams`, `sync_runs`, index d'acquisition et contraintes de
lease. Aucun flux actif n'est créé automatiquement.
DOWN : refuser si run ou lease actif existe ; exporter/archiver les runs si la
politique de conservation l'exige, puis retirer.

### M4 — Mappings, identité et présence

UP : créer mappings/présence, ajouter à `events` le FK de lien et le hash ;
backfill seulement lorsque `provider_key` correspond sans ambiguïté à un lien.
Les ambiguïtés restent nulles et signalées, sans fusion. Ajouter le nouvel index
unique après détection préalable des collisions.
DOWN : refuser tant qu'un Événement dépend exclusivement de la nouvelle
identité ; sinon retirer index/colonnes/tables en conservant les anciennes.

### M5 — Alertes et assets logo

UP : créer alertes et assets ; ajouter `championships.logo_asset_id` tout en
conservant `logo_url`.
DOWN : refuser si assets locaux existent, sauf export préalable explicite.

Chaque migration dépend de la précédente, vérifie `schema_migrations`, est
idempotente, testée sur base vierge et Lot 4.4, puis rollback/réapplication.
Le démarrage API reste en lecture seule. La suppression des colonnes historiques
est exclue du Lot 5 et nécessitera une migration ultérieure distincte.

## 11. Découpage d'implémentation après validation

1. **5.1 DB + contrats** : M1/M2, registre d'adaptateurs et types sans appels.
2. **5.2 Secrets et configuration instance** : chiffrement, CLI de clé, API.
3. **5.3 Championnats et source configs** : découverte inactive, ajout manuel,
   stratégies OCBlackTop/TheSportsDB et test de source.
4. **5.4 Scheduler persistant** : M3, leases, curseurs, reprise, commandes.
5. **5.5 Quotas et cadence** : policies, observations, réserve 30 %, backoff.
6. **5.6 Bootstrap et historique** : current-first, round-robin, saisons,
   boucle courante et `start_year`.
7. **5.7 Normalisation et idempotence** : M4, mappings, hash, corrections,
   présence et seuil d'absence.
8. **5.8 Runs, logs et alertes** : historique durable, redaction, rotation, M5.
9. **5.9 Administration MEDS** : pages, formulaires adaptateur, logos et états.
10. **5.10 Acceptation/durcissement** : fixtures, concurrence, crash, sécurité,
    Windows, Docker, VPS, Chromium, CI et non-régression Lots 4.1–4.4.

Chaque sous-lot possède une fixture synthétique idempotente, un rollback, une
recette isolée et un arrêt de validation mainteneur avant le suivant.

## 12. Décisions à confirmer pendant l'audit Phase 0

- limites finales du logo (proposition : PNG/JPEG/WebP, 2 Mio, 2048²) ;
- durée maximale d'un lease et plafonds du backoff, qui doivent être mesurés
  avec les adaptateurs réels ;
- marge de sécurité exacte du calcul de quota ;
- durée de conservation des résumés `sync_runs` (distincte des logs 30 jours) ;
- nomenclature finale des codes d'erreur et d'alerte.

Ces paramètres ne bloquent pas le modèle. Ils doivent être décidés avant le
sous-lot qui les implémente et ne peuvent pas être déduits des maquettes.

## 13. Point d'arrêt

Cette Phase 0 ne contient aucun code, route runtime, migration ou composant UI.
Après validation documentaire et commit, l'implémentation reste interdite
jusqu'à confirmation explicite du mainteneur.
