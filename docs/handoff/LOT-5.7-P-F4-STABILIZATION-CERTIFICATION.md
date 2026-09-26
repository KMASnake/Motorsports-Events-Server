# F4-6 — Gate final de certification de stabilisation

Statut de cette sous-phase : **MAINTAINER VALIDATED**.

F4 global: **COMPLETE**. Cette clôture enregistre la décision explicite du
mainteneur après audit du commit F4-6 et de sa CI exacte ; elle ne commence pas
F5, n’autorise aucun déploiement et ne modifie aucune validation F3.

## Identité de la baseline certifiée F4-4

- branche : `codex/lot-5-providers-sync` ;
- HEAD : `8553fb9c1b69790169f46a6e96ba4f02d8cf6601` ;
- tree : `dc0a25485a2ef056617ec4421cd84c5bbc28d0f1` ;
- clôture F4-5 maintainer-validated : HEAD
  `a455e720fe49061a818881a9385942ad6d613261`, tree
  `f81d71f15368e08e5427f9ecb23815c3a06d4432` ;
- le candidat F4-6 est un descendant distinct. La baseline F4-4 et la clôture
  F4-5 ne doivent jamais être réécrites avec son identité.
- clôture F4-6 maintainer-validated : HEAD
  `5776aca7d3bab642f7655a8df6975d243a5b8796`, tree
  `16b20c5208faa6187b9402d29ed873f7fe08b69e`.

## État consolidé

- F4-0: **VALIDATED** — clôture F3 enregistrée sans reconstruire les preuves ;
- F4-1: **VALIDATED** — archive alimentée exclusivement par les blobs Git,
  exclusion des environnements sensibles, traversées refusées, sortie atomique ;
- F4-2: **VALIDATED** — contexte préproduction canonique, backup/restore
  jetable et opérations excluant le worker ;
- F4-3: **VALIDATED** — chaîne de migrations exacte et readiness fail-closed ;
- F4-4: **VALIDATED** — base événementielle vide isolée et API réelle ;
- F4-5: **VALIDATED** — consolidation validée par le mainteneur, CI legacy
  #263 et Node #532 en succès sur l’identité exacte ci-dessus ;
- F4-6: **VALIDATED** — gate final statique/documentaire validé explicitement
  par le mainteneur au commit et à la CI exacts documentés ici.

## Preuves historiques F3

F3 reste **COMPLETE / PROVEN** selon
[LOT-5.7-P-F3-CLOSURE.md](LOT-5.7-P-F3-CLOSURE.md). La baseline prospective N,
les identités OCI, la preuve Phase 2 externe et leurs checksums restent
inchangés. F4-5 ne requiert aucun accès au VPS et ne supprime, ne déplace, ne
reconstruit ni ne modifie aucun artefact F3.

## Preuve runtime F4-4

La preuve sanitizée est
[lot57pf4-empty-event-runtime.json](evidence/lot57pf4-empty-event-runtime.json).
Le mainteneur a exécuté le harnais sur la baseline ci-dessus et confirmé :

- `F4-4 isolated empty event database: PASS` ;
- mode Docker isolé, migration head `0031_real_circuit_reference_data` ;
- calendrier public vide `[]`, RC `0` ;
- aucun conteneur, réseau ou répertoire temporaire F4-4 résiduel ;
- zéro appel provider, worker non démarré ;
- aucune mutation préproduction ou Production.

Cette consolidation ne rejoue pas le harnais.

<!-- F4-STABILIZATION-EVIDENCE
{
  "baseline_git_head": "8553fb9c1b69790169f46a6e96ba4f02d8cf6601",
  "baseline_git_tree": "dc0a25485a2ef056617ec4421cd84c5bbc28d0f1",
  "runtime_mode": "docker",
  "migration_head": "0031_real_circuit_reference_data",
  "calendar_empty": true,
  "harness_rc": 0,
  "cleanup": {"containers": 0, "networks": 0, "temp_dirs": 0},
  "provider_calls": 0,
  "worker_started": false,
  "preprod_mutated": false,
  "production_mutated": false,
  "ci": {
    "legacy": {"workflow": "Validate legacy Python server", "run_number": 261, "conclusion": "SUCCESS"},
    "node": {"workflow": "CI — Node target", "run_number": 530, "conclusion": "SUCCESS"}
  }
}
F4-STABILIZATION-EVIDENCE -->

## Preuves CI distinctes

Le mainteneur a vérifié sur GitHub, pour le SHA exact de la baseline :

- `Validate legacy Python server` #261 : **SUCCESS** ;
- `CI — Node target` #530 : **SUCCESS**.

Une CI verte n’est pas à elle seule une validation mainteneur. Elle complète
ici les preuves runtime et statiques déjà auditées.

La clôture F4-5 maintainer-validated, distincte de cette baseline runtime, est
identifiée par le HEAD/tree indiqué plus haut. Sur ce HEAD exact :

- `Validate legacy Python server` #263 : **SUCCESS** ;
- `CI — Node target` #532 : **SUCCESS**.

La clôture F4-6 maintainer-validated est identifiée par le HEAD
`5776aca7d3bab642f7655a8df6975d243a5b8796` et le tree
`16b20c5208faa6187b9402d29ed873f7fe08b69e`. Sur ce commit exact :

- `Validate legacy Python server` #264 : **SUCCESS** ;
- `CI — Node target` #533 : **SUCCESS**.

## Validateur de clôture

`scripts/validate-f4-stabilization.mjs` refuse notamment : preuve absente ou
élargie, mauvaise baseline HEAD/tree, ascendance F4 rompue, migration head ou
contrat applicatif incohérent, invariant packaging/opérations/readiness absent,
preuve runtime non sûre, résidu non nul, appel provider, worker démarré, CI non
SUCCESS, identité/CI F4-5 ou F4-6 incorrecte, sous-phase F4 obligatoire non
validée, F5 commencé/autorisé, Production autorisée ou contradiction entre les
documents de clôture.

Le validateur accepte que le candidat F4-6 soit descendant de F4-5 : il ne
confond donc ni le candidat, ni la clôture F4-5, ni la baseline runtime F4-4.

## Frontières

F4-6 n’ajoute aucune fonctionnalité métier, migration ou modification Compose.
Toutes les garanties techniques F4 sont satisfaites ; aucune nouvelle preuve
runtime n’est nécessaire. Les sept conditions de clôture sont satisfaites :
F4-0..F4-5 validés, commit F4-6 audité, CI exacte de ce commit verte, aucun
blocker F4 ouvert, documents/preuves cohérents, aucun changement fonctionnel
hors périmètre et décision explicite du mainteneur. F4 est donc **COMPLETE**.

F5: **NOT STARTED / NOT AUTHORIZED**. F5 reste le provider-first réel :
découverte et résolution canonique, modèle de saison, acquisition et
synchronisation, normalisation/déduplication et préparation results-ready.
Production Preview, Production, onboarding externe et merge `main` restent
interdits. Production: **NOT AUTHORIZED**.
