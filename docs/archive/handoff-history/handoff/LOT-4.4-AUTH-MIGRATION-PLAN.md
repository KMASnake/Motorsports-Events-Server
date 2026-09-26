# Lot 4.4 — Plan de migration Authentification

Date : 2026-08-11

Statut : implémenté en étape 1, validation mainteneur requise

Migration proposée : `0006_admin_console_authentication`

## Modèle minimal

### `admin_accounts`

- `id uuid primary key`, généré par l'application ;
- `singleton_key boolean not null default true unique` avec
  `check (singleton_key)` afin de garantir un seul compte ;
- `username text not null` ;
- `username_normalized text not null unique` ;
- `password_hash text not null` (chaîne PHC Argon2id) ;
- `active boolean not null default true` ;
- `created_at`, `updated_at`, `password_changed_at` en `timestamptz`.

Contraintes : identifiants non vides après trim, hash non vide. Aucun mot de
passe clair ni secret réversible.

### `admin_login_guard`

- `singleton_key boolean primary key default true` avec `check` ;
- `failed_attempts integer not null default 0 check (failed_attempts >= 0)` ;
- `window_started_at timestamptz null` ;
- `blocked_until timestamptz null` ;
- `updated_at timestamptz not null default now()`.

La ligne est créée avec le compte initial dans la même transaction. Le verrou
`FOR UPDATE` sérialise les tentatives concurrentes.

### `admin_sessions`

- `id uuid primary key`, identifiant interne non envoyé au navigateur ;
- `admin_account_id uuid not null references admin_accounts(id) on delete
  cascade` ;
- `token_hash bytea not null unique check (octet_length(token_hash)=32)` ;
- `created_at timestamptz not null` ;
- `last_seen_at timestamptz not null` ;
- `idle_expires_at timestamptz not null` ;
- `absolute_expires_at timestamptz not null` ;
- `revoked_at timestamptz null` ;
- contraintes : expirations après création, idle au plus égale à absolute,
  last_seen comprise dans la durée de la session.

Index :

- index sur `admin_sessions(admin_account_id)` ;
- index partiel sur `idle_expires_at` pour les sessions non révoquées ;
- index sur `absolute_expires_at` pour le nettoyage.

Les cookies, tokens bruts et jetons CSRF ne sont jamais stockés.

## UP

1. créer les trois tables avec `if not exists` ;
2. créer contraintes et index nommés de façon stable ;
3. enregistrer `0006_admin_console_authentication` dans `schema_migrations` avec
   `on conflict do nothing` ;
4. ne créer aucun compte et ne lire aucun secret pendant la migration.

Le compte est exclusivement créé ensuite par la commande bootstrap.

## Idempotence

- le runner ignore une version déjà enregistrée ;
- le SQL UP reste protégé par `if not exists` ;
- une deuxième exécution ne modifie ni compte, ni session, ni état de blocage ;
- le démarrage API vérifie la version et les objets en lecture seule.

## DOWN gardé

Le DOWN refuse avec exception si :

- `admin_accounts` contient un compte ;
- `admin_sessions` contient une session, y compris révoquée ;
- `admin_login_guard` contient un état non initial.

Après nettoyage explicite dans un environnement de recette : suppression des
index, puis `admin_sessions`, `admin_login_guard`, `admin_accounts`, puis de la
ligne `schema_migrations`. Aucun `cascade` global ni suppression silencieuse.

## Nettoyage

- une session révoquée est inutilisable immédiatement ;
- suppression des sessions révoquées depuis plus de 24 heures ;
- suppression des sessions dont idle ou absolute expiry est dépassée ;
- nettoyage opportuniste borné au login/contrôle de session ;
- commande de maintenance future testable pour un nettoyage explicite ;
- jamais de suppression du compte ou de l'audit par ce nettoyage.

## Compatibilité

- aucune table Lot 4.1–4.3 modifiée ;
- `admin_audit_log` existant réutilisé ;
- `ADMIN_AUTH_SECRET` et les Bearer HMAC existants conservés ;
- sauvegardes PostgreSQL couvrent automatiquement les nouvelles tables ;
- aucun compte créé automatiquement au démarrage ou par Docker Compose.

## Validation future

- base vierge et base Lot 4.3 avec empreinte avant/après ;
- deuxième UP ;
- deux démarrages API en lecture seule ;
- création compte puis persistance après redémarrage ;
- garde DOWN avec compte, session et état de blocage ;
- nettoyage explicite, DOWN, empreinte Lot 4.3 et réapplication ;
- contraintes singleton, token hash, temps, clés étrangères et cascade du
  compte uniquement dans une base de recette.

La migration a été créée après validation explicite de la Phase 0. Sa recette
isolée est fournie par `scripts/test-lot44-auth-foundation.sh`.
