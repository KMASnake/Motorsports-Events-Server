# 5.7-P-F2-RPV — validation fournisseur réelle F1

Statut : **AUTORISÉE — NON EXÉCUTÉE — NON VALIDÉE**  
Date d’autorisation : 2026-08-27

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
