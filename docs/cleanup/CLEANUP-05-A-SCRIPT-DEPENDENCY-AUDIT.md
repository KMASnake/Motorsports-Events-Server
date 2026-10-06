# CLEANUP-05-A — Inventaire des scripts et graphe de dépendances

Date : 2026-08-25

Baseline fonctionnelle de référence : `8a603232bfec44711cfac382e4f73687dd370e53`

Branche de nettoyage : `cleanup/architecture-state-model`

## Objet

Ce document inventorie les entrypoints racine, `scripts/`, `scripts/data/` et leurs appels depuis les quatre surfaces demandées : `package.json`, GitHub Actions, Docker Compose et autres scripts connus.

CLEANUP-05-A est strictement un audit. Il n'autorise aucune suppression. Une absence de référence dans `package.json`, CI ou Compose signifie seulement « aucun consommateur direct dans ces surfaces », pas « script mort ».

## Résumé du graphe

```text
Développeur / CI
│
├─ package.json
│  ├─ validate:lot2 ───────────────► scripts/validate-lot2.mjs
│  ├─ cleanup / cleanup:all ───────► scripts/cleanup.ps1
│  ├─ reset ───────────────────────► scripts/reset-dev.ps1
│  ├─ validate:lot3 ───────────────► scripts/validate-lot3.mjs
│  ├─ test:lot3 ───────────────────► scripts/test-lot3.ps1
│  ├─ validate:lot4 ───────────────► scripts/validate-lot4.mjs
│  ├─ validate:step2 ──────────────► scripts/validate-step2.mjs
│  ├─ validate:step3 ──────────────► scripts/validate-step3.mjs
│  ├─ test:lot4 ───────────────────► scripts/test-lot4.ps1
│  ├─ data:generate ───────────────► scripts/data/generate-realistic-test-data.ts
│  ├─ data:verify ─────────────────► scripts/data/verify-sanitized-data.ps1
│  ├─ test:migrations ─────────────► scripts/test-lot42-migrations.sh
│  ├─ validate:audit-step2..5 ─────► scripts/validate-audit-step2..5.mjs
│  ├─ test:lot43:* ────────────────► scripts/test-lot43-*.sh
│  ├─ test:lot44:* ────────────────► scripts/test-lot44-*.sh
│  ├─ test:lot51:foundations ──────► scripts/test-lot51-foundations.sh
│  ├─ test:lot52:* ────────────────► scripts/test-lot52-secrets.sh
│  ├─ test:lot53 ──────────────────► scripts/test-lot53-discovery.sh
│  ├─ test:lot54 ──────────────────► scripts/test-lot54-scheduler.sh
│  ├─ test:lot55 ──────────────────► scripts/test-lot55-quota-cadence.sh
│  ├─ test:lot56:foundations ──────► scripts/test-lot56-foundations.sh
│  ├─ test:web-security ───────────► scripts/test-web-security.sh
│  ├─ test:public-security ────────► scripts/test-public-api-security.sh
│  └─ test:security-visual ────────► scripts/test-pre55-security-visual.sh
│
├─ .github/workflows/ci.yml (Node courant)
│  ├─ npm ci / audit / typecheck / lint / test / build
│  ├─ node scripts/generate-admin-token.mjs
│  ├─ npm run data:generate
│  ├─ npm run validate:lot4
│  ├─ npm run validate:step2
│  ├─ npm run validate:step3
│  └─ Playwright
│
├─ .github/workflows/validate.yml (legacy Python)
│  ├─ scripts/validate-repository.sh
│  │  ├─ scripts/validate-python.py
│  │  ├─ unittest tests/test_*.py
│  │  └─ bash -n sur tous les *.sh du dépôt
│  ├─ scripts/test-postgres.sh
│  │  └─ docker-compose.test.yml
│  └─ scripts/build-release.sh
│     └─ scripts/validate-repository.sh
│
├─ docker-compose.yml
│  ├─ API/worker Node : aucun script de scripts/
│  └─ migrations : infra/postgres/migrations/migrate.sh
│
├─ docker-compose.preprod.yml
│  └─ aucun script de scripts/
│
└─ docker-compose.test.yml
   └─ aucun script de scripts/ ; appelé par scripts/test-postgres.sh
```

## Entry points racine

La racine conserve deux familles distinctes.

### Wrappers de compatibilité

Ces fichiers très courts doublonnent un script homonyme sous `scripts/`. Le modèle `exec bash <repo>/scripts/<nom>.sh "$@"` est confirmé pour `backup.sh` et `start.sh`. Avant CLEANUP-05-B, le contenu de chaque wrapper devra être vérifié, mais ils forment clairement une couche d'entrée de compatibilité :

- `backup.sh` → `scripts/backup.sh`
- `fix-postgres-permissions.sh` → `scripts/fix-postgres-permissions.sh`
- `logs.sh` → `scripts/logs.sh`
- `restart.sh` → `scripts/restart.sh`
- `restore.sh` → `scripts/restore.sh`
- `show-keys.sh` → `scripts/show-keys.sh`
- `start.sh` → `scripts/start.sh`
- `status.sh` → `scripts/status.sh`
- `stop.sh` → `scripts/stop.sh`
- `uninstall.sh` → `scripts/uninstall.sh`
- `update.sh` → `scripts/update.sh`
- `upgrade.sh` → `scripts/upgrade.sh`
- `verify-installation.sh` → `scripts/verify-installation.sh`

Décision 05-A : `KEEP_COMPAT` jusqu'à audit de documentation/installation. Leur suppression éventuelle doit être séparée de la suppression des implémentations sous `scripts/`.

### Installer racine autonome

`install.sh` n'est pas un wrapper. Il constitue un ancien orchestrateur d'installation VPS/Synology et appelle directement :

```text
install.sh
├─ scripts/detect-environment.py
├─ scripts/configure.py
├─ scripts/env_get.py
├─ scripts/healthcheck.py
└─ scripts/first-sync.py
```

Il contient encore des hypothèses legacy (version affichée 2.1.0, PostgreSQL 16, profils d'installation historiques, première synchronisation Python). Il doit rester `LEGACY_FROZEN` jusqu'au cutover du backend Python ; ses cinq helpers ne peuvent donc pas être supprimés isolément.

## Scripts opérationnels / release

### KEEP tant que production legacy et chaîne d'upgrade existent

- `backup-timer-status.sh`
- `backup.sh`
- `build-release.sh`
- `configure.py`
- `detect-environment.py`
- `env_get.py`
- `first-sync.py`
- `fix-postgres-permissions.sh`
- `healthcheck.py`
- `install-backup-timer.sh`
- `lib.sh`
- `logs.sh`
- `monitoring-start.sh`
- `monitoring-status.sh`
- `preflight-upgrade.sh`
- `restart.sh`
- `restore.sh`
- `show-keys.sh`
- `start.sh`
- `status.sh`
- `stop.sh`
- `uninstall-with-data.sh`
- `uninstall.sh`
- `update.sh`
- `upgrade-files.sh`
- `upgrade.sh`
- `verify-backup.sh`
- `verify-installation.sh`

`build-release.sh` est actif dans le workflow legacy de release et appelle `validate-repository.sh`. `validate-repository.sh` impose encore les fichiers du serveur Python et vérifie la syntaxe de tous les `.sh` du dépôt ; cela crée une dépendance indirecte importante : tant que ce validateur existe, tout script shell conservé doit au minimum rester syntaxiquement valide.

## Scripts de développement Windows

Entrées explicites de `package.json` :

- `cleanup.ps1`
- `reset-dev.ps1`
- `test-lot3.ps1`
- `test-lot4.ps1`

Wrappers `.cmd` ou scripts anciens sans consommateur direct identifié dans package/CI/Compose :

- `cleanup.cmd`
- `reset-dev.cmd`
- `start-clean.cmd`
- `start-clean.ps1`
- `test-lot1.ps1`
- `test-lot2.cmd`
- `test-lot2.ps1`
- `test-lot3.cmd`
- `test-lot4.cmd`

Décision 05-A : les cinq premiers scripts explicitement référencés restent `KEEP`; le reste devient `CANDIDATE_05_B`, sous réserve d'un contrôle des README/docs et de leur contenu exact.

## Scripts historiques 4.x

### Référencés par package.json : KEEP pour l'instant

- `test-lot42-migrations.sh`
- `test-lot43-api.sh`
- `test-lot43-corrections.sh`
- `test-lot43-migrations.sh`
- `test-lot43-ui.sh`
- `test-lot44-auth-api.sh`
- `test-lot44-auth-foundation.sh`
- `test-lot44-auth-ui.sh`
- `test-lot44-final.sh`
- `validate-audit-step2.mjs`
- `validate-audit-step3.mjs`
- `validate-audit-step4.mjs`
- `validate-audit-step5.mjs`
- `validate-lot2.mjs`
- `validate-lot3.mjs`
- `validate-lot4.mjs`
- `validate-lot43-api.mjs`
- `validate-lot43-corrections.mjs`
- `validate-step2.mjs`
- `validate-step3.mjs`

### Sans consommateur direct identifié dans package/CI/Compose : candidats d'archivage

- `test-lot42-final.cmd`
- `test-lot42-final.ps1`
- `test-lot43-final.cmd`
- `test-lot43-final.ps1`
- `test-lot44-final.cmd`
- `test-lot44-final.ps1`

Ces scripts ne sont pas déclarés morts : ils restent des preuves historiques jusqu'à CLEANUP-05-B.

## Scripts provider 5.1–5.6

Ces scripts couvrent les invariants qui sous-tendent encore 5.7-P-F. Ils ne doivent pas être supprimés simplement parce qu'un lot est validé.

### Entrées de package.json

- `test-lot51-foundations.sh`
- `test-lot52-secrets.sh`
- `test-lot53-discovery.sh`
- `test-lot54-scheduler.sh`
- `test-lot55-quota-cadence.sh`
- `test-lot56-foundations.sh`

### Preuves complémentaires non exposées comme npm script principal

- `test-legacy-provider-uuid-repair.sh`
- `test-lot56-acquisition.sh`
- `test-lot56-corrections-observations.sh`
- `test-lot56-orchestration.sh`
- `test-lot56-temporality.sh`
- `test-lot56-transaction.sh`
- `validate-lot52.mjs`
- `validate-lot53-manual.mjs`
- `validate-lot53.mjs`
- `validate-lot54-audit.mjs`
- `validate-lot54.mjs`
- `validate-lot55.mjs`
- `validate-lot56-corrections-observations.mjs`
- `validate-lot56-finalization-restart.mjs`
- `validate-lot56-orchestration.mjs`
- `validate-lot56-temporality.mjs`
- `validate-lot56-transaction.mjs`

Décision 05-A : `KEEP_PROVIDER_REGRESSION` jusqu'à consolidation dans une suite de tests canonique. Une future suppression doit d'abord déplacer les assertions, pas seulement retirer les fichiers.

## Scripts 5.7-P

Aucun de ces scripts n'est démarré automatiquement par Compose. Ils sont des recettes/certifications explicites. Les scripts F restent particulièrement sensibles car ils constituent les preuves du bounded runner certifié.

- `test-lot57pa-foundations.sh`
- `test-lot57pb-normalization.sh`
- `test-lot57pc-history-migration.sh`
- `test-lot57pc-publication.sh`
- `test-lot57pd-preview-api.sh`
- `test-lot57pe-client-security.sh`
- `test-lot57pf-bounded-provider-runner.sh`
- `test-lot57pf-canonical-handoff.sh`
- `test-lot57pf-certification.sh`
- `test-lot57pf-normalization-mapping-repository.sh`
- `test-lot57pf-normalization-mapping.sh`
- `validate-lot57pb-normalization.mjs`
- `validate-lot57pc-publication.mjs`
- `validate-lot57pd-preview-api.mjs`
- `validate-lot57pe-client-security.mjs`
- `validate-lot57pf-bounded-provider-runner.mjs`
- `validate-lot57pf-canonical-handoff.mjs`
- `validate-lot57pf-certification.mjs`
- `validate-lot57pf-normalization-mapping-repository.mjs`

Le couple suivant est explicitement confirmé :

```text
test-lot57pf-bounded-provider-runner.sh
└─ node scripts/validate-lot57pf-bounded-provider-runner.mjs
```

Décision 05-A : `KEEP_57P_EVIDENCE`. Ne pas archiver avant clôture de 5.7-P-F et intégration durable de leurs assertions.

## Sécurité et readiness

À conserver :

- `test-pre55-security-visual.sh`
- `test-preproduction-vps-readiness.sh`
- `test-public-api-security.sh`
- `test-web-security.sh`

Les trois scripts `test:web-security`, `test:public-security` et `test:security-visual` sont exposés par `package.json`. Le readiness VPS reste une recette d'exploitation importante même s'il n'est pas appelé par CI.

## Scripts/data

Inventaire exhaustif :

- `export-production.ps1`
- `generate-realistic-test-data.ts`
- `import-production-snapshot.ps1`
- `reset-from-production-snapshot.cmd`
- `reset-from-production-snapshot.ps1`
- `sanitize-test-data.sql`
- `verify-sanitized-data.ps1`

Dépendances externes explicites :

```text
CI Node ─► npm run data:generate ─► generate-realistic-test-data.ts
package.json ─► data:verify ──────► verify-sanitized-data.ps1
```

Les scripts de snapshot production forment une famille cohérente et potentiellement sensible ; ils ne doivent pas être supprimés individuellement avant audit de leur documentation et du workflow de recette.

## Scripts de validation génériques

- `check-bootstrap.mjs` : aucun appel direct identifié dans les quatre surfaces ; candidat à contrôle 05-B.
- `generate-admin-token.mjs` : appelé directement par la CI Node ; `KEEP`.
- `validate-python.py` : appelé par `validate-repository.sh` ; `KEEP_LEGACY`.
- `validate-repository.sh` : appelé par CI legacy et `build-release.sh` ; `KEEP_LEGACY`.
- `test-postgres.sh` : appelé par CI legacy ; `KEEP_LEGACY`.
- `build-release.sh` : appelé par CI legacy ; `KEEP_LEGACY`.

## Docker Compose

### `docker-compose.yml`

Aucune dépendance directe à `scripts/`. Les migrations utilisent `infra/postgres/migrations/migrate.sh`; le worker exécute `apps/api/dist/worker.js`.

### `docker-compose.preprod.yml`

Aucune dépendance directe à `scripts/`. L'override préprod ne lance aucun helper shell du répertoire.

### `docker-compose.test.yml`

Aucune dépendance directe à `scripts/`. Le sens de l'appel est inverse : `scripts/test-postgres.sh` invoque `docker-compose.test.yml`.

## GitHub Actions

### CI Node actuelle

Scripts réellement requis :

- `generate-admin-token.mjs`
- `data/generate-realistic-test-data.ts`
- `validate-lot4.mjs`
- `validate-step2.mjs`
- `validate-step3.mjs`

Le reste des validations Node provient des scripts npm standards (`typecheck`, `lint`, `test`, `build`) et non de `scripts/`.

### Workflow Validate server legacy

Scripts réellement requis :

- `validate-repository.sh`
- `validate-python.py` (transitif)
- `test-postgres.sh`
- `build-release.sh`

Il reste couplé à `server/**`, aux tests Python, `VERSION`, `MILESTONE` et `docker-compose.test.yml`.

### Workflow Docker

Aucun script de `scripts/`.

## Classification pour CLEANUP-05-B

### Suppression/archivage potentiellement peu risqué après contrôle documentaire

- wrappers `.cmd` non référencés : `test-lot2.cmd`, `test-lot3.cmd`, `test-lot4.cmd`, `test-lot42-final.cmd`, `test-lot43-final.cmd`, `test-lot44-final.cmd`;
- wrappers PowerShell finaux non référencés : `test-lot42-final.ps1`, `test-lot43-final.ps1`, `test-lot44-final.ps1`;
- `test-lot1.ps1` et `test-lot2.ps1` si aucune documentation active ne les invoque;
- `check-bootstrap.mjs` si aucune dépendance documentaire/indirecte n'est trouvée;
- éventuellement les wrappers racine, mais seulement après vérification que README/installation/release ne les présentent plus comme API utilisateur.

### À ne pas supprimer en 05-B

- chaîne release/upgrade/backup/monitoring;
- scripts appelés par package.json;
- scripts appelés par CI;
- helpers de `install.sh` tant que legacy Python n'est pas supprimé;
- 5.4–5.6 regressions provider;
- toutes les preuves 5.7-P, en particulier 5.7-P-F;
- scripts de sécurité et readiness;
- scripts/data tant que leur workflow n'est pas remplacé.

## Conclusion

Le répertoire `scripts/` n'est pas un simple cimetière de lots. Il mélange quatre générations : exploitation legacy, développement Windows, validations Node historiques et certifications provider actuelles. La suppression sûre doit donc se faire en deux temps :

1. CLEANUP-05-B : retirer uniquement wrappers/recettes précoces sans consommateur direct ni documentation active ;
2. après cutover et consolidation des tests : supprimer la chaîne Python/legacy et regrouper les tests de lots en suites canoniques.

Aucun script n'est supprimé par CLEANUP-05-A.
