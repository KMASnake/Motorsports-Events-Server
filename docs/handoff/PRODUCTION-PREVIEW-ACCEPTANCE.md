# Production Preview — Acceptance

Date : 2026-08-16  
Statut : **ACCEPTANCE DE CONCEPTION — IMPLÉMENTATION NON AUTORISÉE PAR CE DOCUMENT**

## 0. Objet et gouvernance

Ce document définit les critères d'acceptation testables de la stratégie **Production Preview** décrite dans `docs/handoff/PRODUCTION-PREVIEW-CONCEPT.md`.

Il ne modifie aucun gate d'implémentation :

- le Lot 5.6 reste le seul lot actuellement autorisé en implémentation ;
- le Lot 5.7 et la tranche 5.7-P restent **NON AUTORISÉS** tant qu'une décision mainteneur explicite ne les ouvre pas ;
- ce document ne vaut ni validation du Lot 5.6, ni autorisation de fusion dans `main`, ni autorisation des Lots 5.7+ ;
- les critères ci-dessous deviennent applicables à l'implémentation uniquement après ouverture explicite du périmètre correspondant.

La Production Preview accélère l'ordre de livraison, sans créer de voie technique parallèle ou jetable.

---

# 1. Architecture et frontière 5.6 / 5.7-P

### PP-001 — Source 5.6 strictement privée

Aucune route cliente ne doit exposer directement :

- `provider_source_entities` ;
- traversals ;
- checkpoints ;
- quotas fournisseur ;
- anomalies d'acquisition ;
- IDs externes fournisseur ;
- credentials ;
- graphes source ;
- détails de pagination.

**Preuve attendue :** tests de contrat/API démontrant l'absence de ces champs sur toutes les surfaces publiques.

### PP-002 — Aucun endpoint Preview parallèle

La Preview utilise `/api/v1` et ne crée pas de namespace temporaire `/preview`, `/beta-preview` ou équivalent.

### PP-003 — Event-as-Session préservé

Le modèle métier doit conserver l'invariant :

> 1 Event métier = 1 Session métier.

Un Meeting ne doit pas transformer le modèle interne en `Event → Sessions`.

### PP-004 — Même architecture pour Preview et production finale

Aucun composant du chemin Preview ne doit être explicitement jetable après la Preview : mêmes IDs, mêmes ressources, mêmes contrats de synchronisation, mêmes règles d'identité.

---

# 2. Identifiants publics et tombstones

### PP-005 — UUID Motorsports Events indépendants des fournisseurs

Les IDs publics Event, Meeting, Championship et Circuit sont des UUID Motorsports Events et ne doivent jamais être des IDs fournisseur bruts.

### PP-006 — Stabilité Event

Une modification de nom, horaire, circuit, statut, sponsor ou fournisseur ne crée pas un nouvel Event si l'identité métier reste la même.

**Scénario obligatoire :**

1. Event publié avec UUID X ;
2. heure `14:00 → 15:00` ;
3. resynchronisation ;
4. UUID = X.

### PP-007 — Stabilité Meeting

Une variation de nom/sponsor d'une épreuve ne crée pas un nouveau Meeting si son identité métier reste la même.

### PP-008 — Tombstone permanent

Un UUID public retiré n'est jamais recyclé pour une autre ressource.

### PP-009 — `removed` n'efface pas l'existence historique

Une ressource retirée du dataset client conserve au minimum son identité/tombstone durablement.

---

# 3. Championship et visibilité client

### PP-010 — États de visibilité distincts

Le système supporte :

```text
internal
preview
public
suspended
```

indépendamment de l'état d'acquisition/synchronisation interne.

### PP-011 — `internal` invisible

Un championnat `internal` ne doit être retourné par aucune route cliente, même si ses données sont présentes et synchronisées.

### PP-012 — `preview` soumis aux droits client

Un championnat `preview` n'est visible qu'aux clients disposant de l'entitlement correspondant.

### PP-013 — `suspended` coupe la publication, pas l'acquisition

Passer un championnat à `suspended` doit pouvoir stopper immédiatement sa visibilité client sans supprimer ses Events/Meetings ni arrêter automatiquement 5.6.

### PP-014 — Kill switch championnat

Le passage `preview/public → suspended` doit être effectif sur l'API cliente sans destruction de données.

---

# 4. Modèle Event public

### PP-015 — Contrat Event minimal

Un Event public expose au minimum :

- `id` ;
- `revision` ;
- `slug` ;
- championnat ;
- nom ;
- session type + nom humain ;
- `starts_at` ;
- `ends_at` nullable ;
- `timezone` ;
- statut ;
- venue/circuit lorsque connu ;
- `data_quality` ;
- `last_updated_at`.

### PP-016 — Taxonomie session extensible

Les types initiaux supportés sont au minimum :

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

Une valeur fournisseur inconnue ne doit pas forcer une mauvaise catégorie.

### PP-017 — Nom humain distinct du type

`session.type` normalisé et nom humain restent deux informations distinctes.

### PP-018 — Statuts publics

Les statuts publics Preview sont :

```text
scheduled
completed
cancelled
postponed
```

`draft` ne doit jamais apparaître sur les routes publiques.

### PP-019 — Pas de `live` non fiable

Aucun statut `live` n'est exposé tant qu'une source suffisamment fiable et un contrat normatif ne permettent pas de l'établir.

### PP-020 — Dates publiques UTC

`starts_at` et `ends_at` sont exposés en ISO-8601 UTC ; `timezone` porte le fuseau IANA local.

### PP-021 — Fin estimée non exposée comme certaine

Si seule une estimation interne 5.6 de fin existe, `ends_at` public doit rester `null`.

### PP-022 — Pays canonique

Les pays utilisent ISO 3166-1 alpha-2.

### PP-023 — Pré-1970

Les dates antérieures à 1970 doivent être manipulables sans test `timestamp > 0`, sentinelle Unix 0 ou limitation de plateforme.

---

# 5. Meeting et regroupement de lecture

### PP-024 — Ressource Meeting stable

Un Meeting possède son propre UUID stable Motorsports Events.

### PP-025 — Un Event appartient à zéro ou un Meeting

Le modèle relationnel doit empêcher l'appartenance simultanée d'un même Event à plusieurs Meetings actifs.

### PP-026 — `sessions[]` est une projection

Les sessions d'un Meeting sont dérivées des Events ; elles ne constituent pas une copie métier indépendante.

### PP-027 — Correction Event reflétée dans Meeting

Une correction d'horaire/statut d'un Event doit être visible dans `/meetings/{id}` sans maintenir une seconde valeur divergente.

### PP-028 — Meeting partiel autorisé

Un Meeting peut être publié avec `completeness=partial` lorsqu'une partie des sessions n'est pas encore fiable, sans inventer de complétude.

### PP-029 — `complete` uniquement démontré

`completeness=complete` n'est autorisé que si la complétude du Meeting est réellement démontrable.

---

# 6. Normalisation 5.7-P et liens source

### PP-030 — Liens source durables Event

Une source déjà associée à un Event doit retrouver le même Event au replay.

### PP-031 — Liens source durables Meeting

Une source Meeting déjà associée doit retrouver le même Meeting au replay.

### PP-032 — Source déjà liée ne repasse pas en matching

Une source disposant d'un lien stable existant ne doit pas être rematchée à chaque synchronisation.

### PP-033 — Idempotence de replay

Rejouer 100 fois la même source avec la même `normalization_version` doit produire :

- le même Event ;
- le même Meeting ;
- les mêmes liens ;
- aucun doublon.

### PP-034 — Version de normalisation

Toute normalisation doit être attribuable à une `normalization_version` durable.

### PP-035 — Nouvelle version sans remap silencieux

Une nouvelle version de normalisation ne doit jamais remapper silencieusement une identité publique déjà publiée.

### PP-036 — Provenance interne

L'administration doit pouvoir remonter d'un Event public à sa/son source, normalisation, traversal et run pertinents, sans exposer cela aux clients.

---

# 7. Matching Event

### PP-037 — Source déjà liée = identité prioritaire

Le lien source existant prime sur les changements de nom, horaire ou circuit.

### PP-038 — Incompatibilités fortes éliminatoires

Un candidat Event est éliminé en cas d'incompatibilité forte, notamment :

- championnat différent ;
- saison incompatible ;
- Meeting certain différent ;
- type de session incompatible ;
- incompatibilité temporelle manifeste.

### PP-039 — Seuil auto-match initial

Le seuil initial d'auto-match Event est `>= 90`, configurable/versionné.

### PP-040 — Seuil review initial

Un candidat plausible `>= 75` mais insuffisant pour auto-match doit passer en `review_required`.

### PP-041 — Marge minimale

L'auto-match exige une marge d'au moins 15 points entre meilleur et second candidat.

**Scénario obligatoire :** 94/92 => `review_required`, jamais auto-match.

### PP-042 — Au moins deux signaux structurels

Même avec un score élevé, l'auto-match exige au moins deux signaux structurels indépendants.

### PP-043 — FP1/FP2 non fusionnées

Deux essais libres proches temporellement ne doivent jamais être fusionnés s'ils représentent des types/sessions distincts.

### PP-044 — Sprint/Race non fusionnées

Sprint et Race le même jour ne doivent jamais être fusionnées.

### PP-045 — Aucun fuzzy match seul

La similarité de nom seule, la date seule ou le circuit seul ne suffit jamais à auto-matcher.

### PP-046 — Aucun LLM décisionnaire

Aucun LLM ne décide automatiquement de l'identité Event en production.

---

# 8. Matching Meeting

### PP-047 — Championnat/saison obligatoires

Un Meeting candidat d'un autre championnat ou d'une autre saison est incompatible.

### PP-048 — Round fiable comme signal fort

Lorsque le championnat fournit un round fiable, `championship + season + round` peut constituer un signal déterministe fort.

### PP-049 — Sessions communes comme preuve forte

Des Events déjà liés en commun constituent un signal prioritaire de correspondance entre Meetings.

### PP-050 — Sponsor non identitaire

Un changement de sponsor dans le nom d'une épreuve ne doit pas créer automatiquement un nouveau Meeting.

### PP-051 — Ambiguïté Meeting => review

Si deux Meetings restent plausibles, aucune fusion automatique n'est autorisée.

---

# 9. Décisions manuelles d'identité

### PP-052 — Décision `linked` durable

Une décision administrative liant explicitement une source à une cible doit être persistée et rejouable.

### PP-053 — Décision `rejected` durable

Une décision `source S ≠ Event/Meeting X` doit empêcher la reproposition automatique du même candidat.

### PP-054 — Audit des décisions

Toute décision manuelle d'identité doit être auditée avec acteur, cible, motif et timestamp.

---

# 10. Overrides et corrections

### PP-055 — Override jamais écrasé

Une nouvelle synchronisation fournisseur ne doit jamais détruire ou écraser un override administratif actif.

### PP-056 — Valeur effective cohérente

La valeur publique/effective doit refléter l'override tant qu'il reste actif.

### PP-057 — Convergence source/override non destructive

Si la source rejoint la valeur d'override, le système peut signaler la convergence mais ne supprime pas automatiquement l'override.

---

# 11. Absence, annulation et retrait

### PP-058 — Absence ≠ suppression

Une `not_observed` confirmée en 5.6 ne doit ni supprimer, ni dépublier, ni annuler automatiquement un Event.

### PP-059 — Annulation explicite

Une annulation fournisseur explicitement fiable se traduit par `status=cancelled`, pas par la disparition de l'Event.

### PP-060 — Postponed reste visible

Un Event `postponed` reste public tant que sa publication n'est pas explicitement retirée.

### PP-061 — `removed` réservé au dataset public

`removed` indique qu'une ressource quitte le dataset client ; il ne doit pas être produit sur simple absence fournisseur.

---

# 12. Publication, qualité et last-known-good

### PP-062 — États de normalisation

Le système supporte au minimum :

```text
ready
review_required
blocked
```

### PP-063 — Première publication interdite en review

Une nouvelle ressource `review_required` ne doit jamais être publiée automatiquement.

### PP-064 — Last-known-good pour objet déjà publié

Si une nouvelle candidate devient ambiguë pour un Event déjà publié, la dernière version fiable reste servie.

### PP-065 — Pas de change log sur candidate rejetée/non promue

Une candidate ambiguë qui ne modifie pas l'état public ne crée aucune entrée dans le journal public de changements.

### PP-066 — Blocage au plus petit périmètre

Une anomalie doit bloquer le plus petit périmètre dont la fiabilité n'est plus garantie : Event avant Meeting, Meeting avant Championship.

### PP-067 — Practice isolée ne bloque pas F1

Une Practice `review_required` isolée ne doit pas rendre tout le championnat F1 indisponible.

### PP-068 — Race ambiguë dégrade le Meeting

Une Race ambiguë doit bloquer l'Event concerné et dégrader le Meeting sans nécessairement rendre l'API entière indisponible.

### PP-069 — États opérationnels Meeting

Le Meeting supporte :

```text
healthy
degraded
blocked
```

### PP-070 — États qualité publics simplifiés

L'API publique expose au minimum :

```text
freshness: fresh | delayed | stale | unknown
completeness: complete | partial | unknown
```

sans exposer les détails internes P1/P2/provider.

### PP-071 — `stale` n'implique pas dépublication

Une donnée stale ne disparaît pas automatiquement de l'API.

### PP-072 — Championship dégradé mais accessible

Un championnat peut rester `preview/public` tout en étant opérationnellement `degraded`.

### PP-073 — Suspension forte non automatique par défaut

Le passage à `suspended` n'est pas déclenché automatiquement pour une anomalie isolée ordinaire.

---

# 13. API publique `/api/v1`

### PP-074 — Routes minimales

La Preview expose au minimum :

```text
GET /api/v1/championships
GET /api/v1/championships/{id}
GET /api/v1/events
GET /api/v1/events/{id}
GET /api/v1/meetings
GET /api/v1/meetings/{id}
GET /api/v1/changes
```

### PP-075 — Aucun champ fournisseur public

Aucune route publique ne retourne `provider_key`, `external_id`, traversal, run, quota ou credential.

### PP-076 — Événements futurs par défaut

Sans `from` explicite, la requête Events Preview retourne le futur pertinent, pas l'historique complet.

### PP-077 — Filtres Event minimaux

Support attendu :

- championnat slug ou ID ;
- `from` ;
- `to` ;
- `status` ;
- `session_type` ;
- `limit` ;
- `cursor`.

### PP-078 — Slug et UUID non ambigus

Si slug et UUID sont tous deux fournis pour le même filtre et sont incompatibles, la requête est refusée.

### PP-079 — Collection enveloppée

Les collections publiques retournent un objet `data + pagination`, jamais un tableau brut non extensible.

### PP-080 — Pagination cursor stable

Le tri Events est au minimum stable par `starts_at ASC, id ASC` ou équivalent déterministe.

### PP-081 — Limites pagination

Valeur par défaut = 50, maximum = 100 pour les collections générales, sauf contrat plus strict documenté.

### PP-082 — Curseur opaque

Le client ne dépend jamais de la structure interne du cursor.

### PP-083 — Erreurs structurées

Les erreurs publiques utilisent au minimum :

```text
invalid_request
unauthorized
forbidden
not_found
rate_limit_exceeded
service_unavailable
internal_error
```

avec `request_id`.

### PP-084 — Pas de détail sensible en erreur

Aucune erreur publique ne doit révéler stack trace, SQL, secret, payload fournisseur ou topologie interne.

### PP-085 — Compatibilité V1

Dans `/api/v1`, sont interdits sans version majeure : suppression/renommage de champ, changement de type ou changement de signification.

---

# 14. Synchronisation incrémentale client

### PP-086 — Snapshot initial cohérent

Un premier chargement paginé doit être rattaché à une frontière de snapshot cohérente.

### PP-087 — `page_cursor` distinct de `sync_cursor`

Le curseur de pagination et le curseur de synchronisation ne doivent jamais être confondus ou réutilisés l'un pour l'autre.

### PP-088 — Journal monotone

Le journal public utilise une séquence monotone durable pour ordonner les changements publics.

### PP-089 — `updated_at` non utilisé comme garantie de sync

`updated_at` peut être informatif mais n'est pas le mécanisme principal de reprise incrémentale.

### PP-090 — Types de ressources changées

`/changes` supporte au minimum :

```text
event
meeting
championship
```

### PP-091 — Opérations de changement

Support minimal :

```text
created
updated
removed
availability_changed
```

### PP-092 — Atomicité état public/change log

La promotion de l'état public et l'écriture du change log sont atomiques dans la même transaction.

### PP-093 — Crash entre état et journal impossible

Un crash ne doit jamais laisser un état public modifié sans entrée de journal correspondante, ni l'inverse.

### PP-094 — At-least-once idempotent

Un client peut rejouer la même séquence sans produire de duplication locale s'il applique les changements idempotemment.

### PP-095 — `revision` monotone par ressource

Chaque modification de l'état public augmente la `revision` de la ressource.

### PP-096 — Changement d'heure

Une modification `starts_at` doit produire une entrée `updated` avec `changed_fields` contenant `starts_at`.

### PP-097 — Annulation = updated

Une annulation produit `updated/status`, jamais `removed`.

### PP-098 — Meeting mis à jour si sessions changent

L'ajout/retrait d'une session publiée dans un Meeting produit un changement Meeting cohérent.

### PP-099 — Filtrage du journal par entitlement

Un client F1 ne reçoit aucune information de change log MotoGP/WRC, même pas les IDs.

### PP-100 — Cursor lié au client/dataset, pas à la clé physique

Une rotation d'API key d'un même client ne casse pas sa synchronisation.

### PP-101 — Cursor n'est jamais une autorisation

Les droits sont réévalués à chaque requête `/changes`.

### PP-102 — Cursor expiré explicite

Un cursor hors rétention retourne `410 Gone` avec `sync_cursor_expired` et demande un full resync.

### PP-103 — Rétention configurable

La rétention initiale cible de Preview est 90 jours, configurable.

### PP-104 — Include data optionnel

Le contrat peut supporter `include=data` sans changer la sémantique du journal ; `removed` retourne alors `current=null`.

---

# 15. Authentification API client

### PP-105 — Auth machine-to-machine séparée de l'admin

Les API keys clients ne réutilisent pas les sessions humaines de l'ACP.

### PP-106 — Format de clé

Le système distingue au minimum :

```text
mse_live_
mse_test_
```

### PP-107 — Secret jamais stocké en clair

La clé complète n'est jamais persistée en clair dans PostgreSQL.

### PP-108 — Clé affichée une seule fois

À la création, la clé complète est affichable une seule fois ; ensuite seule une empreinte/prefix est disponible.

### PP-109 — Vérification cryptographique

La vérification repose sur une primitive adaptée aux secrets à forte entropie, avec secret/pepper serveur hors DB.

### PP-110 — Comparaison constant-time

La comparaison de credential doit éviter les comparaisons naïves sensibles au timing.

### PP-111 — Plusieurs clés actives par client

Un client peut avoir plusieurs clés actives pour permettre la rotation sans interruption.

### PP-112 — Révocation immédiate

Une clé révoquée ne peut plus appeler l'API.

### PP-113 — Suspension client globale

Suspendre un `api_client` invalide l'accès de toutes ses clés.

### PP-114 — Clé perdue non récupérable

La seule procédure est création d'une nouvelle clé puis révocation de l'ancienne.

### PP-115 — Authorization jamais loggé

Le header `Authorization` et les clés complètes ne doivent apparaître dans aucun log, erreur ou trace.

---

# 16. Scopes et entitlements

### PP-116 — Scopes fonctionnels séparés

Scopes minimaux :

```text
championships:read
events:read
meetings:read
changes:read
```

### PP-117 — Entitlements championnats séparés des scopes

Les droits F1/MotoGP/etc. ne sont pas encodés dans le nom des scopes.

### PP-118 — F1 Preview minimale

Un premier client Preview F1 peut recevoir :

- les quatre scopes read ;
- l'entitlement F1 uniquement.

### PP-119 — `/championships` filtré

Un client F1 ne voit que les championnats auxquels il a accès.

### PP-120 — Dataset explicitement interdit = 403

Une requête de collection ciblant explicitement un championnat non autorisé retourne `403`.

### PP-121 — Ressource individuelle interdite = 404

La lecture directe d'un UUID appartenant à un championnat non autorisé retourne `404`, pour éviter l'énumération.

### PP-122 — Scope insuffisant = 403

Un client sans `changes:read` appelant `/changes` reçoit `403 insufficient_scope`.

---

# 17. Rate limiting et quotas clients

### PP-123 — Rate limit au niveau client

Le rate limit principal s'applique à `client_id`, pas uniquement à chaque clé.

### PP-124 — Valeur Preview initiale

Valeur de départ : 60 requêtes/minute/client, configurable.

### PP-125 — Quota journalier

Valeur de départ : 10 000 requêtes/jour/client, configurable.

### PP-126 — Reset journalier UTC

Le quota journalier se réinitialise à `00:00 UTC`.

### PP-127 — Page size configurable

Limites de page générale et `/changes` sont configurables par client ou profil.

### PP-128 — `/changes` compte comme une requête

Une page `/changes`, quel que soit le nombre de changements retournés, consomme une requête API.

### PP-129 — 429 rate limit

Un dépassement de rafale retourne `429`, `Retry-After` et un code `rate_limit_exceeded`.

### PP-130 — 429 quota journalier

Un quota journalier épuisé retourne `429` avec un code distinct `daily_quota_exceeded` et information de reset.

### PP-131 — Headers de limite

Les réponses exposent des headers RateLimit cohérents avec les limites effectives.

### PP-132 — 5xx non imputé au quota commercial

Une erreur serveur 5xx ne doit pas être imputée au quota journalier client.

---

# 18. Observabilité client et audit

### PP-133 — Request ID

Chaque requête possède un `request_id` retourné au client et journalisé.

### PP-134 — Usage log sans payload sensible

Les métriques d'usage peuvent enregistrer client/key ID, endpoint, statut, durée et timestamp, jamais le secret.

### PP-135 — Audit des transitions publiques

Les transitions `AUTO_MATCH`, `REVIEW_REQUIRED`, `PUBLICATION_ENABLED`, `PUBLICATION_BLOCKED`, `LAST_KNOWN_GOOD_RETAINED`, `MANUAL_OVERRIDE`, `CHAMPIONSHIP_SUSPENDED` ou équivalentes sont auditables.

---

# 19. Infrastructure Production Preview

### PP-136 — Production Preview = vraie production

La Preview est un état de publication dans l'environnement Production, pas un environnement technique temporaire distinct.

### PP-137 — Staging isolé

Staging et Production utilisent au minimum des DB et secrets distincts.

### PP-138 — Domaine API stable

La cible publique est `https://api.motorsports-events.fr/api/v1` ou domaine officiellement retenu équivalent, sans exposition d'IP/port/container aux clients.

### PP-139 — HTTPS obligatoire

Aucune API key live n'est acceptée via HTTP non chiffré.

### PP-140 — Ports internes non publics

PostgreSQL et services internes ne sont pas exposés directement à Internet.

### PP-141 — API et worker séparés

Les acquisitions fournisseur lourdes ne doivent pas s'exécuter dans le chemin HTTP client de l'API.

### PP-142 — Secrets hors Git

DB password, API key pepper, provider credentials et secrets admin ne doivent pas être versionnés.

### PP-143 — Credentials staging/prod séparés si possible

Lorsque le fournisseur le permet, Staging et Production utilisent des credentials distincts afin d'éviter de consommer le même quota.

### PP-144 — Une seule acquisition logique Production

Les leases/fencing doivent empêcher un double traitement concurrent lors d'un redéploiement/restart worker.

---

# 20. Migrations, déploiement et rollback

### PP-145 — Migrations versionnées

Aucune mutation opportuniste du schéma au démarrage.

### PP-146 — Déploiement compatible rollback applicatif

Les migrations Preview doivent privilégier des changements rétrocompatibles permettant un rollback applicatif sans restauration DB systématique.

### PP-147 — Build identifiable

Chaque release expose au minimum version, Git SHA et build time dans les surfaces techniques appropriées.

### PP-148 — Liveness distincte

`/health/live` vérifie le processus et ne dépend pas des fournisseurs externes.

### PP-149 — Readiness distincte

`/health/ready` vérifie que l'API peut servir les clients, notamment DB et compatibilité des migrations.

### PP-150 — Provider down n'implique pas API unready

Une panne OCBlackTop/TheSportsDB ne rend pas l'API non prête tant qu'un last-known-good fiable reste servable.

### PP-151 — Bascule contrôlée

Une nouvelle instance API n'est mise en trafic qu'après readiness PASS.

### PP-152 — Rollback garde les sync cursors valides

Un rollback applicatif ne doit jamais faire reculer la séquence du journal public ni invalider arbitrairement les cursors déjà délivrés.

---

# 21. Sauvegarde et restauration

### PP-153 — Backup PostgreSQL automatique

Un backup automatique régulier de PostgreSQL est configuré avant premier client externe.

### PP-154 — Backup externe au VPS

Au moins une copie est stockée hors du VPS de production.

### PP-155 — Backup avant migration importante

Une sauvegarde est réalisée avant les migrations présentant un risque significatif.

### PP-156 — Restauration testée

Au moins une restauration complète sur DB distincte doit réussir avant certification Preview.

### PP-157 — Données source 5.6 sauvegardées

Le stockage source durable/rejouable fait partie du périmètre de sauvegarde.

---

# 22. Sécurité opérationnelle

### PP-158 — Surface health publique minimale

Le health public ne révèle pas la topologie, les fournisseurs, DB details ou secrets.

### PP-159 — CORS restrictif

Pas de `Access-Control-Allow-Origin: *` par défaut pour une API Bearer key.

### PP-160 — Premier client backend-to-backend privilégié

La recette Preview initiale doit pouvoir fonctionner en consommation serveur à serveur, sans exposer une API key live dans du JavaScript navigateur.

### PP-161 — OpenAPI contractuelle

Une spécification OpenAPI représente le contrat réel `/api/v1` et est vérifiée contre l'implémentation.

---

# 23. Certification F1 Production Preview

### PP-162 — F1 pilote uniquement

Le premier passage `internal → preview` concerne F1 ; l'ajout d'autres championnats ne modifie pas le contrat API.

### PP-163 — Acquisition current stable

Plusieurs cycles current 5.6 F1 successifs doivent réussir sans P1 ouvert avant Preview externe.

### PP-164 — Normalisation déterministe

Le même dataset F1 rejoué produit les mêmes UUID Events/Meetings et aucun doublon.

### PP-165 — Aucun CRITICAL actif

Aucune anomalie critique active ne doit affecter F1 au moment de l'ouverture Preview.

### PP-166 — Aucune Race ambiguë current-hot

Aucune Race dans la fenêtre current-hot ne doit être en conflit d'identité non résolu.

### PP-167 — Practice historique non bloquante

Une anomalie isolée sur une Practice historique n'interdit pas la Preview F1 si le reste du pipeline satisfait les gates.

### PP-168 — API contract PASS

`championships`, `events`, `meetings`, `changes`, erreurs, pagination et OpenAPI passent la recette.

### PP-169 — Auth PASS

Création client, génération clé, authentification, rotation, révocation et suspension passent la recette.

### PP-170 — Entitlement F1 PASS

Le premier client ne peut voir que F1.

### PP-171 — Rate limit/quota PASS

Les limites Preview fonctionnent réellement avec 429 et reset corrects.

### PP-172 — Kill switch PASS

Passer F1 à `suspended` retire immédiatement F1 du dataset client sans supprimer la donnée interne.

### PP-173 — Last-known-good PASS

Une candidate F1 ambiguë après publication ne remplace pas la dernière version fiable.

### PP-174 — Sync incrémentale E2E PASS

Scénario obligatoire :

1. snapshot client ;
2. Event Race heure A ;
3. source change vers heure B ;
4. normalisation fiable ;
5. même UUID ;
6. revision +1 ;
7. journal sequence +1 ;
8. `/changes` retourne `updated/starts_at` ;
9. client applique la mise à jour.

### PP-175 — Annulation E2E PASS

Un Event annulé reste accessible avec `status=cancelled` et apparaît comme `updated`, jamais comme suppression automatique.

### PP-176 — Ambiguïté E2E PASS

Une source candidate aberrante passe `review_required`, ne modifie pas l'état public, ne crée aucun change public et le last-known-good reste servi.

### PP-177 — Backup/restore PASS

Un backup Production-compatible est restauré avec intégrité des UUID, revisions, sequence/cursors, liens source et données 5.6.

### PP-178 — Rollback release PASS

Une recette `N → N+1 → rollback N` conserve une API utilisable et la continuité de synchronisation client.

### PP-179 — Smoke Production PASS

Après déploiement Production :

- live = 200 ;
- ready = 200 ;
- sans clé `/api/v1/events` = 401 ;
- clé invalide = 401 ;
- clé F1 = F1 visible ;
- `/events` retourne F1 ;
- `/meetings` retourne F1 ;
- `/changes` fournit un cursor valide.

### PP-180 — Premier client manuel ACP

Le premier client Preview peut être créé manuellement depuis l'administration : client → scopes → entitlement F1 → limites → clé live, sans dépendre d'un portail self-service.

---

# 24. Hors périmètre du gate Preview initial

Les fonctionnalités suivantes ne sont pas requises pour le premier client Preview et ne doivent pas être introduites comme prérequis artificiels :

- facturation ;
- Stripe ;
- portail développeur self-service complet ;
- OAuth2 client ;
- JWT client ;
- webhooks ;
- push mobile ;
- résultats sportifs complets ;
- standings ;
- réconciliation multi-provider avancée ;
- UI complète de mapping ;
- certification de tous les championnats ;
- Kubernetes.

Leur absence ne constitue pas un échec de Production Preview 0.1.

---

# 25. Preuves exigées

La certification Production Preview ne peut pas reposer uniquement sur des tests unitaires ou mocks superficiels.

Les preuves doivent inclure, selon le critère concerné :

- PostgreSQL réel ;
- migrations versionnées ;
- transactions et crash/replay ;
- tests concurrentiels lorsque nécessaire ;
- API HTTP réelle ;
- authentification/rate limit réels ;
- OpenAPI contract tests ;
- environnement Docker isolé ;
- staging ;
- smoke tests Production ;
- backup/restore ;
- test de rollback ;
- scénario E2E fournisseur → 5.6 → 5.7-P → API → `/changes`.

Toute preuve substitutive doit être explicitement justifiée et offrir une garantie au moins équivalente.

---

# 26. Règle de clôture

La Production Preview F1 n'est considérée **candidat validable par le mainteneur** que lorsque les critères applicables PP-001 à PP-180 sont couverts ou explicitement déclarés non applicables avec justification approuvée.

Elle n'est considérée **VALIDÉE** qu'après décision mainteneur explicite.

Ce document ne peut jamais, à lui seul :

- autoriser le Lot 5.7 ;
- positionner `maintainer_validated=true` ;
- positionner `merge_authorized=true` ;
- fusionner dans `main` ;
- ouvrir les Lots 5.8+.
