# F5-7D1 — Preuve de certification du handoff provider réel

Cette preuve clôture la certification mainteneur bornée de D0 et D1 du
2026-10-04 (Europe/Paris). L'état courant, les autorisations et la prochaine
action sont définis uniquement dans [PROGRESS.json](PROGRESS.json).
Les documents A/B/C et F5-1 à F5-6 conservent leur contexte historique.
Aucune roadmap inspectée ne définit D1 comme dernière tranche de D.

## Identité de la certification

- D0 pleinement certifié : `959130e5295ff753dcde10d94695d23796e92865`,
  tree `7b5ee0cd53b9b70c91af97ced2cb594ae47e67f8`.
- D1 fonctionnel : `41bf9d34605567b39ab2f6f5b608107ddbecb6ab`,
  tree `c27a8058c11876672c56e15fd3fc785cfb6e36ae`.
- Audit cumulatif final : `F5_7D1_FINAL_CERTIFICATION_AUDIT=PASS` ;
  P1, P2, P3 : `NONE` ; recommandation
  `FAVORABLE_FOR_SCOPED_MAINTAINER_CERTIFICATION`.

Les preuves provider, migration sur base jetable réelle, replays et GitHub CI
ci-dessous sont fournies et certifiées par le mainteneur. Elles ne sont ni
réexécutées ni revérifiées par accès externe lors de cette clôture documentaire.
Les résultats automatisés sont ceux de l'audit cumulatif fonctionnel précédent ;
les validations de ce commit de gouvernance sont rapportées séparément.

## Acquisition unique et diagnostic

OCBlackTop, F1, saison 2026, stream `current` : exactement une requête réelle,
HTTP 200, un traversal, 158 observations reçues et valides, aucune anomalie.
Les sources comprennent 27 Meetings et 131 Events. Le budget historique est
`1/1 CONSUMED` et `DO_NOT_RETRY_PROVIDER=YES`.

D1c produisait 158 reviews : `source.season` et `source_data.season` portaient
2026, mais `source_data.external_season_id` était absent. Le resolver ne
retrouvait pas le lien exact ChampionshipSeason existant. Aucun défaut de
seed n'a été identifié ; les Events héritaient du parent non résolu.

D1d (`84f7107208a73376b71a671ba6a7e298a1eb6188`) résout l'identité de
saison dans l'ordre : identité externe explicite, saison source structurée,
saison persistée. Le lien source exact et unique reste obligatoire, sans
création automatique de Season ; ambiguïtés et parents restent fail-closed.

Le premier handoff offline après D1d a rencontré l'ancienne unicité sémantique
des décisions, qui omettait `candidate_revision` lors du passage de 1 à 2.
L'échec transactionnel n'a laissé aucune mutation canonique/publique partielle.

D1e (`f6d4ec226f3b757a8000a6533478476fc0fc164f`) apporte 0041 :
`UNIQUE NULLS NOT DISTINCT (source_entity_id, candidate_id, candidate_revision,
decision, target_kind, target_id, normalization_version)`.
`UNIQUE(candidate_id,idempotency_key)` est conservée ; l'historique révision 1
reste intact, la révision 2 est légale et les doublons de même révision restent
bloqués. Le DOWN refuse un historique revisionné incompatible.

La migration réelle de certification 0040/40 vers 0041/41 a été transactionnelle.
Les compteurs `1|1|158`, 158 candidats, 158 décisions révision 1 et les compteurs
canoniques/publics nuls ont été préservés avant replay. Le correctif CI
`41bf9d34605567b39ab2f6f5b608107ddbecb6ab` aligne uniquement les attentes du
graphe sur 0041. Legacy Python #293 et Node target #562 : `SUCCESS` au SHA exact.

## Replays offline certifiés

Le replay 1, sans provider runner, credentials ou réseau provider, a normalisé
158 entités : 134 prêtes et 24 en review. Il a créé 26 Meetings, 108 Events,
108 relations meeting_events et 134 changements, versions et états publics.
L'historique contient 158 reviews révision 1, 134 creates révision 2 et
24 reviews révision 2, soit 316 décisions.

Les 24 reviews sont des issues attendues `VALID_FAIL_CLOSED_NON_BLOCKING` :
18 `ambiguous_margin`, 5 `parent_identity_unresolved`, 1 `required_identity_unknown`.
Elles ne sont ni supprimées ni représentées comme données canonicalisées.
Aucun défaut d'intégration déterministe supplémentaire n'a été identifié.

Le replay 2 a retrouvé 158 entités, 134 prêtes et 24 reviews : zéro publication
créée, 134 inchangées, `highest_change_sequence=null`, statut `review_required`.
Les compteurs avant/après sont identiques : `1|1|158`, 26 Meetings, 108 Events,
134 changements et versions publics, 158 candidats, 316 décisions, 24 reviews.
108 Events et 26 Meetings sont `RESOLVED_CREATED/promoted` ; 23 Events et
1 Meeting restent `REVIEW_REQUIRED/pending`. Aucune nouvelle ressource,
version, décision ou modification publique : `REAL_DATA_IDEMPOTENCE=PASS`.

## Audit automatisé final et limites de la preuve

PostgreSQL : F5-7D 14 tests, F5-5 13, F5-6 22, F5-7C 5.
API 534, Web 119, repository 189 dont 18 skipped.
Graphe migrations, compatibilité 0041, typecheck, lint, build et diff-check : PASS.
Cette certification bornée ne vaut pas clôture globale de F5-7D, F5-7 ou F5,
ni certification de F5-7E/F, ni autorisation de Production.
Aucun appel provider, worker, scheduler, accès DB réelle, préproduction,
production, déploiement ou push ne fait partie de cette clôture.

## Inventaire structuré des preuves

Les valeurs suivantes sont comparées par le validateur à la preuve de D1
consignée dans PROGRESS.json. Elles ne définissent aucune autorisation.

<!-- F5-7D1-CERTIFICATION-EVIDENCE
{
  "evidence_classification": "maintainer-supplied-certification-and-final-cumulative-audit",
  "provider": "OCBlackTop",
  "championship": "F1",
  "season": 2026,
  "stream": "current",
  "provider_instance_id": "57f10000-0000-4000-8000-000000000001",
  "provider_championship_id": "57f10000-0000-4000-8000-000000000002",
  "stream_id": "57f10000-0000-4000-8000-000000000003",
  "mapping_version_id": "e65cde43-186d-4f9e-868d-035e2e2dca4b",
  "traversal_id": "cdae6918-4850-47a5-8a78-c0c85e5ae019",
  "acquisition": {
    "requests": 1,
    "request_budget": 1,
    "budget_consumed": true,
    "http_status": 200,
    "traversals": 1,
    "observations": 158,
    "received": 158,
    "valid": 158,
    "anomalies": 0,
    "source_meetings": 27,
    "source_events": 131
  },
  "migration": {
    "before_head": "0040_f5_canonical_timezone_nullability",
    "before_count": 40,
    "after_head": "0041_f5_revisioned_normalization_decisions",
    "after_count": 41,
    "transactional": true,
    "provider_invariants": [
      1,
      1,
      158
    ],
    "candidates": 158,
    "decisions": 158,
    "revision_1_decisions": 158,
    "canonical_public_counts_before_replay": 0
  },
  "replay_1": {
    "entities_seen": 158,
    "entities_normalized": 158,
    "candidates_ready": 134,
    "candidates_review": 24,
    "publications_created": 134,
    "publications_unchanged": 0,
    "meetings": 26,
    "events": 108,
    "meeting_events": 108,
    "public_changes": 134,
    "public_versions": 134,
    "public_states": 134,
    "revision_1_review": 158,
    "revision_2_create": 134,
    "revision_2_review": 24
  },
  "reviews": {
    "classification": "VALID_FAIL_CLOSED_NON_BLOCKING",
    "ambiguous_margin": 18,
    "parent_identity_unresolved": 5,
    "required_identity_unknown": 1,
    "total": 24,
    "canonicalized": false
  },
  "replay_2": {
    "entities_seen": 158,
    "entities_normalized": 158,
    "candidates_ready": 134,
    "candidates_review": 24,
    "publications_created": 0,
    "publications_unchanged": 134,
    "highest_change_sequence": null,
    "status": "review_required",
    "before_after": {
      "provider_invariants": [
        1,
        1,
        158
      ],
      "meetings": 26,
      "events": 108,
      "public_changes": 134,
      "public_versions": 134,
      "candidates": 158,
      "decisions": 316,
      "reviews": 24
    },
    "candidate_states": {
      "event_resolved_created_promoted": 108,
      "event_review_required_pending": 23,
      "meeting_resolved_created_promoted": 26,
      "meeting_review_required_pending": 1
    },
    "new_canonical_resources": 0,
    "new_public_changes": 0,
    "new_public_versions": 0,
    "new_normalization_decisions": 0,
    "real_data_idempotence": "PASS"
  },
  "automated_certification": {
    "f5_7d_postgres": 14,
    "f5_5_postgres": 13,
    "f5_6_postgres": 22,
    "f5_7c_postgres": 5,
    "api": 534,
    "web": 119,
    "repository": 189,
    "repository_skipped": 18,
    "migration_graph": "PASS",
    "schema_compatibility_0041": "PASS",
    "typecheck": "PASS",
    "lint": "PASS",
    "build": "PASS",
    "diff_check": "PASS"
  },
  "ci": {
    "legacy": {
      "workflow": "Validate legacy Python server",
      "run_number": 293,
      "conclusion": "SUCCESS"
    },
    "node": {
      "workflow": "CI — Node target",
      "run_number": 562,
      "conclusion": "SUCCESS"
    }
  }
}
F5-7D1-CERTIFICATION-EVIDENCE -->
