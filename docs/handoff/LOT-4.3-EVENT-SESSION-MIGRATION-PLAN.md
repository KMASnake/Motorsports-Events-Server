# Lot 4.3 — Plan de migration Événement = Session

Statut : conception validée par le mainteneur le 2026-08-11

Référence : `docs/handbook/architecture/ADR-0013-EVENT-AS-SESSION.md`.

## Version prévue

- nom : `0005_event_session_title` ;
- montée : `infra/postgres/migrations/0005_event_session_title.up.sql` ;
- rollback : `infra/postgres/migrations/0005_event_session_title.down.sql` ;
- exécution : service Docker `migrate`, avant le démarrage de l'API ;
- transaction : un seul `psql -1` via le runner existant ;
- prérequis : `0004_sessions` appliquée ;
- trace : version inscrite dans `schema_migrations` uniquement après succès.

## Montée

1. Vérifier que `events` et la révision `0004_sessions` existent.
2. Ajouter idempotemment `events.session_title text null`.
3. Ne modifier aucune valeur des colonnes Événement existantes.
4. Ne copier aucune ligne de `sessions`, car un Événement peut en contenir
   plusieurs dans les bases de recette antérieures.
5. Inscrire `0005_event_session_title` dans `schema_migrations`.

Aucun index n'est requis au départ : le champ sert à la saisie et aux
suggestions, et son volume suit celui des Événements. Un index ne sera ajouté
qu'après mesure d'un besoin réel.

## Rollback

Le rollback s'exécute dans une transaction et :

1. refuse si une ligne `events.session_title` est non nulle et non vide ;
2. laisse intactes les tables de compatibilité `sessions`, `session_types` et
   `session_corrections` ;
3. supprime la colonne `events.session_title` ;
4. retire `0005_event_session_title` de `schema_migrations`.

Pour une recette, seules les valeurs synthétiques de `session_title` sont
remises à null avant la descente. Aucune donnée utilisateur n'est supprimée.

## Contrôles PostgreSQL isolés

La recette devra démontrer :

1. montée depuis `0004_sessions` avec empreinte inchangée des champs existants ;
2. présence de la colonne nullable et absence de valeur inventée ;
3. seconde montée idempotente ;
4. écriture d'un intitulé fournisseur et d'un intitulé inédit ;
5. conservation exacte des accents, espaces et casse affichée ;
6. déduplication insensible à la casse dans les suggestions applicatives ;
7. absence de distinction d'origine dans le contrat de suggestions ;
8. refus du rollback lorsqu'une valeur existe ;
9. rollback après nettoyage explicite des seules fixtures ;
10. réapplication réussie et non-régression de `0004_sessions`.

## Adaptations applicatives après le point d'arrêt

- ajouter `session_title` aux contrats Événement administratifs et publics
  comme champ facultatif ;
- l'inclure dans création, modification, lecture et synchronisation fournisseur
  sans exposer l'origine dans le formulaire ;
- faire agréger à `/api/v1/admin/session-titles` les valeurs Événement et les
  valeurs fournisseur déjà connues ;
- remplacer l'interface multi-sessions par une combobox dans le formulaire
  Événement ;
- retirer du parcours UI les actions CRUD et Corrections Sessions séparées ;
- conserver temporairement les anciennes routes et tables pour compatibilité ;
- remplacer la fixture et les scénarios Chromium multi-sessions.

## Point d'arrêt

Aucune migration ni modification applicative ne doit commencer avant la
validation explicite de ce document et de l'ADR-0013 par le mainteneur.
