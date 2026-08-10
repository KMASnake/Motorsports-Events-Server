# Lot 4.3 Sessions — plan de migration PostgreSQL

Statut : proposé, en attente de validation de conception

Aucun SQL de migration n'est créé par ce document.

## Version prévue

- nom : `0004_sessions` ;
- montée : `infra/postgres/migrations/0004_sessions.up.sql` ;
- rollback : `infra/postgres/migrations/0004_sessions.down.sql` ;
- exécution : service Docker `migrate`, avant le démarrage de l'API ;
- transaction : un seul `psql -1` via le runner existant ;
- trace : insertion de `0004_sessions` dans `schema_migrations` uniquement à la
  fin de la montée réussie.

## Montée prévue

1. Créer `session_types` si absent avec clé, libellé, ordre et activation.
2. Insérer idempotemment les six types initiaux sans écraser un libellé
   administré existant.
3. Créer `sessions` avec les clés étrangères, contrôles de statut, origine et
   cohérence temporelle définis par l'ADR-0012.
4. Créer l'index de parcours `(event_id, starts_at, id)`.
5. Créer les index administratifs nécessaires sur `status`, `published` et
   `type` seulement si les plans PostgreSQL de recette les justifient.
6. Créer l'index unique partiel d'identité fournisseur sur
   `(provider_key, external_id)` lorsque les deux valeurs ne sont pas nulles.
7. Créer `session_corrections`, ses contraintes et ses index par session et
   statut, selon l'ADR-0003.
8. Inscrire la version dans `schema_migrations`.

Aucune ligne `events`, `event_corrections` ou `admin_audit_log` n'est modifiée,
copiée ou supprimée. La base Lot 4.2 conserve donc le même nombre de lignes et
le même contenu après montée.

## Rollback prévu

Le rollback s'exécute dans une transaction et :

1. refuse immédiatement si `sessions` contient une ligne ;
2. refuse si `session_corrections` contient une ligne, même si une incohérence
   de clé étrangère a été introduite hors contraintes ;
3. refuse si le contenu de `session_types` diffère des six lignes initiales,
   y compris par ajout, suppression ou modification de libellé, ordre ou état ;
4. supprime `session_corrections`, puis `sessions`, puis `session_types` ;
5. retire `0004_sessions` de `schema_migrations`.

Le refus sur données actives suit l'ADR-0009 et évite tout rollback destructif.
Pour une recette de rollback avec données, les fixtures synthétiques sont
explicitement supprimées avant la descente. Aucune archive n'est nécessaire,
car la montée ne transforme pas de donnée Lot 4.2 et la descente ne peut pas
supprimer de donnée Session.

## Vérification obligatoire sur PostgreSQL isolé

Le futur test `scripts/test-lot43-migrations.sh` devra couvrir :

1. démarrage depuis une base Lot 4.2 contenant événements et corrections ;
2. empreinte avant migration des tables Lot 4.2, incluant comptes et agrégats
   déterministes ;
3. montée `0004`, présence des trois tables et des six types ;
4. contrôle que l'empreinte Lot 4.2 est inchangée ;
5. seconde montée sans modification ;
6. deux redémarrages API sans écriture de schéma ni de données métier ;
7. insertion de sessions UTC, traversant minuit et le changement DST ;
8. rejet de `ends_at < starts_at`, d'un type inconnu et d'un événement absent ;
9. autorisation de deux sessions qui se chevauchent ;
10. refus du rollback tant qu'une session existe ;
11. suppression des seules fixtures Lot 4.3, rollback réussi et vérification de
    l'empreinte Lot 4.2 ;
12. réapplication réussie de `0004`.

## Adaptations applicatives ultérieures

Après validation de conception seulement :

- ajouter `0004_sessions` à la vérification de schéma en lecture seule ;
- ne jamais ajouter de `create`, `alter`, `update` ou `delete` métier au
  démarrage API ;
- exécuter l'audit des mutations Session dans la même transaction ;
- ajouter un jeu synthétique idempotent avec sessions sans fin, chevauchées,
  minuit, DST, fournisseur, correction et types variés.

## Matrice de conformité

| Exigence | Réponse de conception |
|---|---|
| zéro à plusieurs sessions par événement | FK `sessions.event_id`, aucune session créée pour l'existant |
| UTC, minuit et DST | `timestamptz`, offset API obligatoire, tests dédiés |
| fin facultative et cohérente | null autorisé, contrôle `ends_at >= starts_at` |
| types contrôlés et extensibles | référentiel global `session_types` |
| ordre stable | `(starts_at, id)` |
| création manuelle sans fournisseur | origine serveur `manual`, identité nulle |
| corrections compatibles | `session_corrections` conforme ADR-0003 |
| métadonnées publiques absentes | projection publique dédiée, non issue de `select *` |
| pagination/tri avant découpage | application ADR-0011 |
| audit sans succès non journalisé | transaction commune mutation + audit |
| ingestion séparée | identité de service et routes dédiées futures |
| migration sans perte | aucune mutation des tables Lot 4.2, empreinte vérifiée |
| rollback réversible | refus si données Session ou types personnalisés |

## Point d'arrêt

La création des fichiers SQL, des routes, des types TypeScript ou de
l'interface attend la validation explicite de cet ADR et de ce plan.
