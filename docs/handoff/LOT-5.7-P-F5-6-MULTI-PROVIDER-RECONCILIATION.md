# F5-6 — Réconciliation multi-provider

Statut : `MAINTAINER_VALIDATED`

## Certification mainteneur

- périmètre fonctionnel : réconciliation canonique multi-provider déterministe ;
- commit fonctionnel final certifié : `92fbf798fcd8f51faa3f4adfbc9f7cfa189069b1` ;
- arbre Git certifié : `fc20934ed21b72165003599d73e30cd3feadc2bc` ;
- schéma : `0037_f5_multi_provider_reconciliation` ;
- audit mainteneur final : `PASS` ;
- Legacy Python #283 : `SUCCESS` ;
- Node target #552 : `SUCCESS` ;
- Playwright : `18/18 PASS` ;
- bloqueurs : `NONE`.

La preuve certifie la résolution déterministe et indépendante de l’ordre des
contributions provider, les policies explicites, les overrides canoniques
typés via `canonical_field_overrides`, ainsi que les décisions et conflits.
Elle couvre la matérialisation synchrone de l’état canonique, le bridge et la
migration de `event_corrections`, la conservation pré-normalisation de
`provider_source_corrections`, et l’historique immuable et auditable des
contributions et overrides. L’identité canonique stable des Event et Meeting
est préservée, comme le comportement de publication.

Aucun provider n’a été activé ou exécuté pendant cette clôture, aucun worker
ou scheduler n’a été démarré et aucun déploiement n’a été réalisé. F5 global
reste `IN_PROGRESS`. F5-7 reste `NOT_STARTED_NOT_AUTHORIZED`.
Production reste `NOT_AUTHORIZED`.

Cette implémentation ajoute le schéma `0037_f5_multi_provider_reconciliation`,
un moteur déterministe sans lecture implicite de l’heure, des contributions
immuables Meeting/Event, des policies versionnées, des décisions et conflits,
ainsi que l’autorité unique `canonical_field_overrides`.

Les identités et parentages F5-5 ne sont jamais réconciliés. Une contestation
structurelle est `REVIEW_REQUIRED`; un conflit critique interdit toute mutation
partielle. Preview et apply sont des opérations distinctes et l’apply est borné
par le checksum exact du preview.

Les corrections source restent avant normalisation et leur provenance est
portée par chaque contribution. Les corrections Event legacy actives ou en
conflit sont importées de façon déterministe; les autres lignes restent un
historique. La table legacy est ensuite read-only et les routes historiques
écrivent uniquement l’autorité canonique.

F5-7, l’API publique, le merge d’identités, Results, l’activation provider,
worker, scheduler, préproduction et production restent non autorisés.

La certification intégrée couvre S1-S8, A-I et les corrections P1/P2 avec 20 tests PostgreSQL
obligatoires sans omission ni skip. Les régressions dépôt, API, Web, schéma,
F5-1 à F5-5, sécurité, normalisation et publication restent vertes. Cette
preuve, auditée avec le commit fonctionnel et ses CI finales, fonde la
validation mainteneur ci-dessus ; elle n’autorise ni provider, ni déploiement,
ni phase F5-7.

## Corrections P1 après audit indépendant

La succession des états d'une même source est portée par un
`source_revision` positif, monotone et persistant sur `provider_source_entities`.
Une révision explicitement fournie par un contrat provider peut établir une
succession sémantique; une correction source locale incrémente la révision dans
la transaction qui porte la mutation. Sans révision provider prouvée, une
observation divergente conserve la révision courante : les deux contributions
deviennent alors ambiguës et la réconciliation refuse de choisir. Une révision
explicite antérieure à l'état persistant est refusée avant écrasement. La
révision est figée dans le candidat puis dans chaque
contribution immuable. L'ordre d'arrivée, `observed_at`, `received_at`,
`created_at` et les UUID ne choisissent jamais le gagnant. Deux contenus
distincts portant la même révision maximale rendent la succession ambiguë et
font échouer la réconciliation en revue fail-closed.

Le pont legacy applique un unique contrat explicite : `name -> name`,
`starts_at -> startsAt`, `ends_at -> endsAt`, `status -> status` et
`session_title -> sessionLabel`. Aucun autre champ legacy ne devient
réconciliable implicitement. La certification PostgreSQL part de vraies lignes
`event_corrections` sous 0036, les importe avec 0037, démontre que les overrides
actifs gagnent, puis qu'une révocation explicite révèle les valeurs provider
sans écrire dans le stockage legacy scellé.

Enfin, le moteur reconstruit la projection publique complète depuis les lignes
canoniques Meeting/Event réelles, puis applique seulement les valeurs mutables
réconciliées. Il ne remplace plus `canonical_state` par une projection partielle
et ne traite jamais un ancien `public_resource_states.canonical_state` comme
autorité sur les colonnes canoniques actuelles.

À l’étape P1, ces corrections seules ne fermaient pas F5-6. Les cinq constats
P2 ont ensuite été corrigés et couverts avant les ré-audits indépendants et la
certification finale consignés en tête de document.

## Corrections P2 après audit mainteneur

Le contrat de mutabilité 0037 est explicite : les contributions sont des
`IMMUTABLE SNAPSHOT` dont seul `withdrawn_at` suit une transition contrôlée et
journalisée dans `contribution_status_events`; les runs, décisions, historiques
et mutations d'override sont des `APPEND_ONLY EVIDENCE`; les conflicts,
policies et overrides sont des `CONTROLLED LIFECYCLE ROW`; les lignes
Meeting/Event et leur projection publique restent le `CURRENT MATERIALIZED
STATE`. Les payloads, checksums, versions, provenance, révisions source,
références structurelles et cibles des contributions ne sont jamais modifiés
en place. Les suppressions sont refusées et le retrait conserve le snapshot
ainsi qu'un événement de cycle de vie append-only.

Chaque observation provider qui change l'état mémorisé d'un override actif
produit une révision, une ligne `canonical_field_override_history` marquée
`provider_observed` et une mutation idempotente `provider_observation`. Un
replay identique ne produit aucun delta et aucune observation provider ne
révoque automatiquement l'override.

L'API ne reçoit plus `canonical_record_id` comme autorité indépendante. Le
service le dérive sous le verrou canonique depuis le kind et `entity_uuid`; les
appels internes de compatibilité qui fournissent encore l'identifiant sont
refusés si la paire ne désigne pas la même ligne Meeting/Event. Un trigger DB
protège également toute écriture directe.

`reconciliationFieldContract.ts` est l'unique contrat des champs mutables : il
porte allowlist Meeting/Event, classe, type JSON, nullabilité, borne,
normalisation et validations de références. `round` reste une chaîne bornée ou
`null`, conformément au schéma canonique existant. Venue, Layout et session
type sont validés transactionnellement; un Layout doit appartenir au Venue
effectif. Les champs inconnus, structurels, mal typés et les couples
policy/classe incohérents sont refusés en 4xx avant mutation.

Les index `*_target_revision_idx` servent les lectures par cible canonique et
révision sémantique; les index `*_source_revision_idx` servent la sélection de
la dernière version par source. `reconciliation_runs_entity_created_idx`
supporte l'historique d'une entité et `reconciliation_conflicts_open_idx` la
lecture des conflits ouverts. La certification PostgreSQL vérifie leur
présence et leur utilisabilité par le planner sur un volume représentatif.
