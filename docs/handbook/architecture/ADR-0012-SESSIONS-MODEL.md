# ADR-0012 — Modèle Sessions, audit atomique et ingestion séparée

Statut : Validé par le mainteneur

Date : 2026-08-10

Validation explicite : 2026-08-10. L'implémentation de la migration `0004_sessions` est autorisée conformément à cet ADR et au plan `docs/handoff/LOT-4.3-SESSIONS-MIGRATION-PLAN.md`. Toute évolution du modèle doit faire l'objet d'une nouvelle décision documentée avant implémentation.

## Contexte

Le Lot 4.3 introduit des unités temporelles rattachées à un événement : essais,
qualifications, sprint, warm-up, course et autres types futurs. Le modèle doit
rester compatible avec les événements et corrections du Lot 4.2, ne perdre
aucune donnée lors d'une migration et ne pas confondre une action humaine avec
une ingestion automatisée.

Deux réserves du Lot 4.2 sont traitées par cet ADR : le comportement lorsque
l'audit échoue après une mutation et l'identité de l'ingestion fournisseur.

## Décision — agrégat Session

Une session appartient à exactement un événement ; un événement peut n'avoir
aucune session. La table `sessions` porte :

- `id text` généré par le serveur et clé primaire ;
- `event_id text not null`, clé étrangère vers `events(id)` avec suppression en
  cascade, la session n'ayant pas d'existence hors de son événement ;
- `name text not null` ;
- `type text not null`, clé étrangère vers `session_types(key)` ;
- `starts_at timestamptz not null` et `ends_at timestamptz null` ;
- `status text not null`, limité à `draft`, `scheduled`, `completed`,
  `cancelled` ou `postponed` comme les événements ;
- `published boolean not null default true` ;
- `description text null` ;
- `origin text not null`, limité à `manual`, `provider`, `import` ou `mixed` ;
- `provider_key text null` et `external_id text null` ;
- `created_at` et `updated_at` en `timestamptz`.

La contrainte temporelle accepte une fin absente et impose sinon
`ends_at >= starts_at`. Les entrées API exigent un offset explicite puis sont
normalisées en UTC. Une session peut traverser minuit, un changement d'heure et
chevaucher une autre session.

L'ordre canonique est `starts_at asc, id asc`. Le second terme garantit un
ordre stable en cas d'égalité sans ajouter un ordre manuel au modèle minimal.

## Décision — types extensibles

`session_types` est un référentiel global et non lié à un championnat. Il
contient `key`, `label`, `sort_order` et `active`. La migration initialise :

1. `practice` — Essais ;
2. `qualifying` — Qualifications ;
3. `sprint` — Sprint ;
4. `warmup` — Warm-up ;
5. `race` — Course ;
6. `other` — Autre.

Ajouter un type passe par le référentiel et non par une modification libre de
session. Une clé déjà référencée ne peut pas être supprimée.

## Décision — identité fournisseur et corrections

Une création humaine impose `origin=manual` et des métadonnées fournisseur
nulles. Une identité fournisseur est unique sur
`(provider_key, external_id)` lorsque les deux valeurs existent.

`session_corrections` reprend la sémantique de l'ADR-0003 : une valeur
fournisseur, un override local et une valeur effective séparés champ par champ.
Elle référence la session avec suppression en cascade et rend unique
`(session_id, field_name)`. Les formulaires métier n'exposent jamais origine,
clé fournisseur ou identifiant externe. L'API publique ne renvoie que la valeur
effective et aucune métadonnée technique.

## Décision — audit atomique

Toute mutation de session humaine écrit la session, ses corrections éventuelles
et la ligne `admin_audit_log` avec le même `PoolClient` dans une transaction
PostgreSQL unique. Si l'écriture d'audit échoue, la mutation entière est
annulée et l'API retourne une erreur ; aucun succès métier non audité n'est
autorisé.

Le hook `onSend` hérité ne constitue pas le mécanisme transactionnel des
Sessions et doit éviter toute double écriture lorsqu'un audit atomique a déjà
été produit. La généralisation aux anciennes mutations sera planifiée
séparément et ne change pas leur contrat dans cette phase documentaire.

## Décision — ingestion automatisée

Le Lot 4.3 peut fournir une ingestion manuelle protégée par l'administrateur
pour les recettes. Une automatisation fournisseur future ne réutilisera ni le
jeton d'un humain ni une route de formulaire administratif.

Elle utilisera une famille de routes dédiée à l'ingestion, une identité de
service restreinte portant `role=provider_ingest` et `provider_key`, ainsi qu'un
secret ou mécanisme d'authentification distinct. L'identité déclarée dans le
jeton devra correspondre au fournisseur ciblé. Cette séparation empêche un
service d'obtenir les droits généraux d'un administrateur.

## Conséquences

- la liste publique filtre sessions et événements publiés et masque les champs
  techniques ;
- filtres et tris administratifs sont validés avant pagination conformément à
  l'ADR-0011 ;
- la migration ne transforme aucune ligne Lot 4.2 ;
- la suppression d'un événement supprime ses sessions et corrections dans la
  même transaction ;
- le rollback de la migration refuse de supprimer les nouvelles tables tant
  que des sessions ou types personnalisés subsistent ;
- aucun changement d'interface n'est autorisé avant validation de cet ADR et du
  plan de migration.

## Alternatives rejetées

- stocker les sessions en JSON dans `events` : contraintes, filtres,
  pagination et corrections seraient fragiles ;
- imposer les six types par une contrainte `check` : l'extension exigerait une
  modification de schéma ;
- écrire l'audit après le commit métier : une mutation réussie pourrait rester
  non auditée ;
- donner un jeton administrateur au synchroniseur : privilèges excessifs et
  attribution humaine ambiguë.
