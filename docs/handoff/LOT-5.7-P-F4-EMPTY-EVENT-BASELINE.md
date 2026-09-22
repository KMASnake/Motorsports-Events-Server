# F4-4 — Base événementielle vide

Statut : implémentation locale de la recette ; validation d’environnement PostgreSQL à exécuter.

Cette étape ne clôt ni F4 ni Gate F et ne commence pas F5. F5 n’est ni commencé ni autorisé.

## Contrat

Une base événementielle vide F4-4 est un cluster PostgreSQL neuf, créé par la
recette dans un répertoire temporaire qui lui appartient, initialisé par le
bootstrap canonique puis par toutes les migrations `0001` à
`0031_real_circuit_reference_data`. Elle passe le schema guard applicatif et
sert une liste vide sur `GET /api/v1/events` avec Preview désactivée.

« Vide » signifie zéro donnée transactionnelle de calendrier, acquisition,
normalisation et publication. Cela ne signifie pas zéro ligne dans toutes les
tables. Le dépôt initialise volontairement :

- `championships` et `circuits` dans le bootstrap ;
- les `session_types` de compatibilité dans 0004 ;
- des liens provider legacy désactivés/inactifs dérivés des championnats dans
  0008 ;
- la configuration singleton du scheduler dans 0011 (elle ne lance aucun
  processus ; la recette ne démarre jamais le worker) ;
- les contrôles singleton de publication/historique dans 0025/0027 ;
- le référentiel circuits réel et sa table de suivi dans 0031.

Ces lignes sont des références ou contrôles techniques. Les supprimer
produirait un schéma différent de celui réellement déployé et masquerait les
dépendances de l’application. La recette exige en revanche zéro Event,
Meeting, Session de compatibilité, source/observation/traversal provider,
candidat normalisé, source link, sync run/stream, état public, change public,
client Preview ou consommation de quota.

Il n’existe pas de table `seasons` : la saison est encore un entier porté par
`championships`. C’est un blocage explicite à traiter dans une phase F5
autorisée, pas dans F4-4.

## Inventaire du modèle

| Catégorie | Tables principales | Rôle |
|---|---|---|
| A — technique | `schema_migrations`, tables `migration_*`, `admin_*`, `scheduler_configuration`, `publication_controls`, `public_history_controls` | migrations, sécurité et contrôles singleton |
| B — configuration provider | `provider_instances`, `provider_secrets`, `provider_quota_policies`, `provider_quota_state`, `provider_championships`, `provider_championship_source_configs`, mappings actifs/versionnés | configuration sans exécution |
| C — référentiel événementiel | `championships`, `circuits`, `meetings`, `meeting_events`, `events`; `session_types`/`sessions` en compatibilité | modèle calendrier canonique ; un Event est la Session métier |
| D — synchronisation/provenance | `provider_acquisition_*`, `provider_source_*`, `provider_discovered_championships`, `provider_discovery_runs`, `sync_streams`, `sync_runs`, `event_source_links`, `meeting_source_links`, `normalized_*`, `normalization_*` | acquisition rejouable, identité, mapping et déduplication |
| E — dérivé/publication | `public_resource_states`, `public_resource_versions`, `public_change_log`, `publication_receipts`, `publication_rebuild_checkpoints` | projection publique, révisions, séquences et changements |
| F — futur/hors MVP | aucune table participant/équipe/résultat/classement/statistique ; `sessions` historiques seulement | extension future non implémentée |

Relations canoniques : `championships → events`, `circuits → events`,
`meetings ↔ events` via `meeting_events`, puis liens de provenance séparés vers
les sources provider. Le contrat officiel reste Event-as-Session ; la table
`sessions` est seulement une compatibilité historique.

## Recette isolée

Commande :

```bash
bash scripts/test-f4-empty-event-database.sh
```

La recette n’accepte ni DSN ni nom de base externe. Elle choisit PostgreSQL
natif lorsqu’il est intégralement disponible, sinon un fallback Docker local
jetable. Les deux chemins exécutent les mêmes assertions SQL et HTTP. Elle :

1. neutralise tout DSN/ciblage PostgreSQL, Compose ou Docker hérité, puis crée
   un cluster local neuf sous `/tmp/mse-f4-empty-event-db.*` et un nom de
   base généré `mse_f4_empty_*` ;
2. refuse tout nom protégé et vérifie que la base n’existe pas avant création ;
3. applique le bootstrap, puis le runner canonique de migrations ;
4. vérifie les 31 versions et le head exact ;
5. vérifie la vacuité transactionnelle et l’inactivité provider/scheduler ;
6. démarre uniquement l’API réelle avec Preview OFF, explicitement liée à
   `127.0.0.1`, sur ce cluster ;
7. vérifie `/health`, `/health/ready` et `/api/v1/events == []` ;
8. arrête l’API et le cluster puis supprime uniquement ses ressources marquées.

Le fallback refuse `DOCKER_HOST`/`DOCKER_CONTEXT` hérités, tout contexte autre
que `default` et tout endpoint autre qu’un socket Unix local. Il crée un
conteneur et un réseau bridge dédié aux noms uniques, tous deux étiquetés par
l’identifiant du run. Le réseau n’est pas `--internal` : sur le moteur Docker
certifié, cette option neutralise aussi la publication loopback nécessaire à
l’API lancée sur l’hôte. Le harnais vérifie que ce bridge n’accueille que son
unique conteneur PostgreSQL. PostgreSQL utilise un `tmpfs`, aucun volume Docker, et
un port hôte libre est sélectionné puis publié explicitement sous la forme
`127.0.0.1:<port>:5432/tcp`. `Config.ExposedPorts` décrit l’intention de
l’image et n’est pas une preuve portable de publication sur le conteneur créé.
Le harnais vérifie donc l’unique `HostConfig.PortBindings` demandé avant le
démarrage, attend ensuite la disponibilité réelle de PostgreSQL avec
`pg_isready`, puis vérifie le résultat exact de `docker port`.
`NetworkSettings.Ports` n’est pas une preuve bloquante : certains moteurs le
laissent temporairement à `{ "5432/tcp": null }` malgré un mapping effectif.
Toute sortie `docker port` vide ou multiligne, ambiguïté, autre port
conteneur ou autre adresse est refusée avec un diagnostic. Une connexion TCP
réelle depuis `127.0.0.1` est ensuite exigée. Une
collision entre sélection et démarrage fait échouer `docker start`. Les migrations
sont montées en lecture seule. Le cleanup vérifie les labels avant de supprimer
exactement ce conteneur et ce réseau ; il n’utilise jamais Compose ni prune.

Aucun chemin n’utilise de DB existante ou de `DATABASE_URL` héritée. Aucun
`DELETE`, `TRUNCATE`, DOWN migration, reset ou volume persistant n’est utilisé.
Un échec de preuve de propriété ou de cleanup conserve un statut d’échec et les
diagnostics. Si ni les binaires PostgreSQL natifs (`initdb`, `pg_ctl`,
`createdb`, `psql`) ni un Docker local prouvable ne sont disponibles, la
certification refuse de démarrer.

Le bridge dédié permet techniquement l’egress du seul conteneur PostgreSQL,
mais celui-ci ne contient aucun credential provider, n’exécute aucun code
d’acquisition et ne rejoint aucun réseau applicatif. Cette surface minimale et
temporaire évite une nouvelle chaîne de build API en conteneur. L’API de
certification reste sur l’hôte, liée à `127.0.0.1`, Preview OFF, sans worker ni
scheduler en exécution ; les providers bootstrap sont désactivés/inactifs.

## Matrice provider-first MVP

| Entité | Modèle | Création automatique | ID provider | Déduplication | Blocage F5 |
|---|---:|---:|---:|---:|---|
| Championship/series | YES | PARTIAL | YES | PARTIAL | le bootstrap reste requis ; discovery ne crée pas encore sûrement tout championnat canonique absent |
| Season | NO (entier sur championship) | NO | NO | NO | modèle saison stable à décider |
| Circuit/venue | YES | PARTIAL | PARTIAL | PARTIAL | résolution/mapping dépend du référentiel ; création générique provider-first à formaliser |
| Meeting/round/GP | YES | YES | YES via source link | YES | exige mapping valide et identité parent résolue |
| Session/Event | YES, Event-as-Session | YES | YES via source link | YES | dépend du championnat, circuit/mapping et parent Meeting résolus |

`PROVIDER_FIRST_READY=PARTIAL` : acquisition, provenance, normalisation,
publication et déduplication existent, mais un démarrage sans aucun référentiel
championnat/circuit n’est pas encore garanti et la saison n’est pas une entité.

## Analyse results-ready

`RESULTS_READY=PARTIAL`.

Les UUID normalisés stables des Events, leur relation explicite au Meeting,
les source links provider et la projection publique permettent d’ajouter
ultérieurement une référence `result → event_id` sans exposer la structure des
providers aux consommateurs. En revanche il n’existe encore aucun contrat de
participants, engagements, résultats ou classements, et l’ancienne table
`sessions` coexiste avec le contrat Event-as-Session. Une future phase devra
ancrer les résultats sur l’Event canonique (Session métier), sans réintroduire
une seconde identité concurrente.

La responsabilité demeure strictement :

**Providers → Motorsports-Events → API Motorsports-Events → MyBB / Android / Apple**.

MyBB et les applications mobiles ne doivent jamais appeler directement un
provider ni connaître ses identifiants internes. Ils consomment les identités,
horaires, statuts et changements canoniques de l’API Motorsports-Events.
