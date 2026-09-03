# 5.7-P-F2-RPV — validation fournisseur réelle F1

Statut : **EXÉCUTÉE — PASS — VALIDÉE PAR LE MAINTENEUR**

Date d’autorisation : 2026-08-27

Date d’exécution et de validation : 2026-08-27

SHA applicatif validé : `e21c9d6f85678236ea92712a8e758957790f7e60`

SHA documentaire de départ : `ab0d458cae59850a38f768418cb19f24d05a0a40`

## Résultat mainteneur

La validation fournisseur réelle bornée OCBlackTop/F1 en préproduction est
**PASS**. Elle a consommé exactement **un nouvel appel fournisseur** et un
crédit. Aucun appel fournisseur n'est effectué par la présente mise à jour
documentaire.

### Sauvegarde et état initial

- backup préalable : `backup-pre-f2-rpv-20260827T154004Z.sql.gz` ;
- SHA-256 : `4f9cb40fce9f4ef940826b32eaa26e06af90c88557f50973e07fe1652fcafd69` ;
- provider initialement `enabled=true`, `state=paused`, discovery désactivée ;
- `max_concurrency=1`, worker arrêté, trois charges historiques ;
- premier preflight : configuration prête, exécution bloquée par `provider_paused`, zéro appel.

L'activation temporaire a utilisé l'API admin auditée. Le second preflight a
confirmé configuration et exécution prêtes, sans blocker et avec un budget de
un appel. Discovery est restée désactivée et le worker arrêté.

### Acquisition réelle bornée

- budget CLI : `--max-provider-requests 1` ;
- traversal : `de03e4cf-3c51-41da-8f4a-d0427fbe2ec8` ;
- run : `fc320dcf-7531-444b-a52d-4bf673ca0e79` ;
- unité : `current_global:2026` ;
- statut `complete`, `received_items=158`, `valid_items=158`, `anomaly_items=0` ;
- 27 sources Meeting et 131 sources Event ;
- charge 4, émise, HTTP 200, à `2026-08-27 15:50:44.781+00`.

Une seconde tentative trop rapprochée a été refusée avant émission avec
`quota_deferred/minimum_interval`. Son traversal partiel est
`25a7472e-8961-420f-a177-e46524d8e740`. Elle a produit zéro appel et aucune
charge supplémentaire : il n'existe pas de charge 5.

### Publication et replay

L'état canonique observé après acquisition contient 26 Meetings, 126 Events,
126 relations `meeting_events`, 26 liens source Meeting, 126 liens source
Event et **zéro Event orphelin**.

Le replay du traversal persisté a émis zéro appel fournisseur et produit :

- `entities_seen=185`, `entities_normalized=185` ;
- `candidates_ready=152`, `publications_created=0`, `publications_unchanged=152` ;
- `candidates_review=33`, `highest_change_sequence=null` ;
- version active `mapping:d976f26c-d9f1-4658-a59d-1827dc82639d`.

Les 33 reviews sont entièrement expliquées : 27 Events
`required_identity_unknown`, cinq Events `parent_identity_unresolved` et un
Meeting `required_identity_unknown`. Les 126 Events et 26 Meetings de cette
version sont promus, soit 152 promus + 33 reviews = 185 normalisés.

Les candidats `pending` de l'ancienne version
`mapping:4a868e8e-db64-4dc5-afab-272ac86e0148` sont historiques et ne font pas
partie du résultat courant.

### État final sûr

- quatre charges fournisseur au total, aucune cinquième charge ;
- provider `enabled=false`, `state=paused` ;
- discovery désactivée ;
- worker arrêté.

La sous-phase F2-RPV est validée. Gate F reste toutefois incomplète et non
validée jusqu'à une décision mainteneur séparée couvrant ses autres critères.

## Autorisation bornée

Cette sous-phase autorise exclusivement le mainteneur à conduire en
préproduction une validation réelle du provider **OCBlackTop**, pour le seul
championnat **F1**, avec le CLI canonique `providerAcquireOnce.js`.

Chaque exécution est manuelle, supervisée et possède un
`--max-provider-requests N` faible, strictement positif et explicitement
autorisé avant son lancement. Il n’existe aucun budget implicite. Le worker
reste arrêté ; aucun cron, scheduler, discovery, boucle automatique, curl vers
le provider ou script réseau ad hoc n’est autorisé.

Cette autorisation ne couvre ni Production Preview, ni client externe, ni
publication externe supplémentaire, ni autre championnat/provider, ni Lot
5.7 complet, ni Lot 5.8+, ni merge vers `main`.

## Identifiants et journal de preuve

Avant chaque exécution, le mainteneur consigne sans secret :

- SHA déployé et timestamp UTC ;
- UUID exacts de l’instance OCBlackTop, de l’association F1 et du stream
  `current` ;
- UUID et version du mapping actif attendu ;
- budget `N`, appels attendus au maximum et crédits exposés au maximum ;
- compteurs quota et dernière `charge_sequence` avant exécution ;
- état du provider, de l’association, du stream, du worker et des leases ;
- chemin et timestamp du backup PostgreSQL vérifié.

Aucun credential, plaintext, ciphertext, nonce, clé maître, token ou header
`Authorization` ne doit apparaître dans la console, le journal ou les preuves.

## Procédure obligatoire

### 1. Backup

Avant toute nouvelle acquisition réelle :

1. créer un backup PostgreSQL préproduction hors du dépôt ;
2. le compresser avec gzip ;
3. vérifier que le fichier existe, est non vide et que `gzip -t` réussit ;
4. consigner son chemin absolu protégé et son timestamp UTC ;
5. arrêter immédiatement si une étape échoue.

### 2. État sûr et preflight zéro crédit

Le worker doit être arrêté et aucun lease inattendu ne doit exister. Construire
l’API déployée puis exécuter le preflight canonique avec les UUID exacts :

```sh
npm run build --workspace @mse/api
npm run provider:acquire-once --workspace @mse/api -- \
  --provider-instance-id <ocblacktop-provider-uuid> \
  --provider-championship-id <ocblacktop-f1-association-uuid> \
  --stream-id <f1-current-stream-uuid> \
  --max-provider-requests <budget-explicitement-autorise> \
  --preflight
```

Le rapport doit prouver :

- ciblage OCBlackTop/F1/current exact ;
- `configuration_ready=true` ;
- mapping effectif attendu et binding de reprise cohérent ;
- `credential_present=true`, sans lecture ni affichage du secret ;
- politique quota/cadence cohérente ;
- aucun lease actif inattendu ;
- `provider_requests_emitted=0` et `PROVIDER_CALLS=0`.

Le provider et l’association ne peuvent être placés temporairement dans leur
état exécutable qu’au moment expressément décidé par le mainteneur. Répéter
alors le même preflight et exiger `execution_ready=true`. L’activation ne doit
jamais démarrer le worker, discovery ou le scheduler.

### 3. Relevé quota avant exécution

Consigner pour le provider et le stream ciblés :

- politiques minute/heure/jour/mois, marge, réserve et intervalle minimal ;
- lignes et compteurs `provider_request_charges` ;
- dernière `charge_sequence` ;
- fenêtres et runtime quota ;
- nombre exact d’appels/crédits avant exécution.

STOP si le quota est proche d’une limite non prévue ou si une charge est
inexpliquée.

### 4. Exécution réelle bornée

Immédiatement avant la commande, afficher et consigner :

```text
EXPECTED_PROVIDER_CALLS=at-most-the-approved-budget
MAX_PROVIDER_CALLS=<strict-positive-integer-approved-by-maintainer>
PROVIDER_CREDITS_AT_RISK=<same-strict-upper-bound>
=== REAL PROVIDER CALL — MAINTAINER AUTHORIZED FOR OCBLACKTOP F1 PREPRODUCTION ===
```

Puis exécuter exclusivement :

```sh
npm run provider:acquire-once --workspace @mse/api -- \
  --provider-instance-id <ocblacktop-provider-uuid> \
  --provider-championship-id <ocblacktop-f1-association-uuid> \
  --stream-id <f1-current-stream-uuid> \
  --max-provider-requests <budget-explicitement-autorise>
```

Tout nouvel essai ou page supplémentaire constitue une nouvelle exécution et
requiert un nouveau budget explicitement autorisé et un nouveau preflight.

### 5. Contrôles après chaque exécution

Comparer avant/après et consigner :

- traversal, statut, complétude, cursor, fencing et mapping lié ;
- `provider_source_entities`, observations et changements source ;
- `normalized_candidates`, décisions et reviews ;
- `meetings`, `events`, `meeting_events` ;
- `meeting_source_links`, `event_source_links` ;
- `public_resource_states`, `publication_receipts` et, si pertinent,
  `public_change_log` ;
- charges, séquences et compteurs quota ;
- `provider_requests_emitted`, appels réels et crédits exacts.

L’intégrité F1 exige : Meetings distincts, aucune collision cross-meeting,
chaque Event rattaché au bon parent, `wrong_parent=0`, aucun orphelin ou
doublon, circuits/horaires/statuts cohérents, mapping attendu et anomalies
source confinées en review sans correction arbitraire.

### 6. Replay sans fournisseur

Après une acquisition complète et publiée, rejouer uniquement le traversal
persisté par le handoff canonique, sans nouvelle requête fournisseur. Les
données inchangées doivent produire `publications_created=0`, le nombre
attendu de `publications_unchanged`, aucune duplication et aucune nouvelle
charge fournisseur.

### 7. Retour à l’état sûr

À la fin ou au premier STOP :

1. remettre le provider/association dans leur état non exécutable validé ;
2. confirmer que le worker est toujours arrêté ;
3. vérifier lease, traversal et quota ;
4. conserver le last-known-good et les preuves ;
5. ne supprimer aucune donnée source ou review pour embellir le résultat.

## STOP immédiat

Arrêter la sous-phase en cas d’erreur SQL ou de normalisation, dépassement du
budget, charge inexpliquée, mauvais parent, doublon, Event orphelin, worker
actif, lease inattendu, traversal ou mapping incohérent, quota imprévu, fuite
potentielle de secret ou anomalie source non confinée en review.

## Critères de validation mainteneur

La sous-phase reste non validée tant que les seize preuves suivantes ne sont
pas toutes acquises : acquisition réelle bornée réussie ; appels exacts
connus ; quota cohérent ; traversal cohérent ; source persistée ; normalisation
cohérente ; Meetings distincts ; Events correctement rattachés ;
`wrong_parent=0` ; aucun orphelin ; aucun doublon ; reviews entièrement
expliquées ; replay idempotent ; aucune mutation inattendue ; worker resté
arrêté ; audit mainteneur final PASS.

Le succès de F2-RPV n’autorise pas automatiquement la clôture de Gate F. Cette
décision reste séparée et explicite.
