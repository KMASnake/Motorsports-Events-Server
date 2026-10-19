# Passation — lot 4 rev.1

## État à reprendre

Le lot `8.1.0-alpha.2-lot.4-rev.1` est développé, validé localement, validé par
GitHub Actions et accepté par l'utilisateur sur un VPS isolé. La PR #24 est
verte au commit `dcbf76575a648082e98df9202f4b3b6506338515`.

## Contrats préservés

- aucune modification incompatible des routes `/api/v1` ;
- aucun changement du schéma PostgreSQL dans cette révision ;
- aucune métadonnée provider ajoutée à l'API publique ;
- production historique 2.7.0 non modifiée ;
- page Championnats fonctionnelle.

## Validation disponible

- validation locale : builds web/API, typecheck, tests unitaires, Chromium,
  Docker et validateur API ;
- validation GitHub : CI et construction Docker réussies ;
- validation VPS : `LOT-4-REV-1-VPS-VALIDATION.md` ;
- checklist : `LOT-4-REV-1-ACCEPTANCE.md`.

## Prochaine action

1. Relire et fusionner la PR #24 dans `main`.
2. Vérifier que `main` reste vert après fusion.
3. Choisir explicitement le prochain lot avant tout développement.
4. Ne pas déployer ce prototype 8.1 sur la production 2.7.0 avec l'ancien
   `scripts/upgrade.sh`.

## Ordre de lecture pour le prochain assistant

1. `CODEX.md`
2. `PROJECT-STATUS.json`
3. `docs/handover/LOT-4-REV-1-HANDOFF.md`
4. `docs/handover/LOT-4-REV-1-VPS-VALIDATION.md`
5. `docs/handover/PROGRESS.json`
