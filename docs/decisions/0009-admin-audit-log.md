# ADR 0009 — Journal d’administration persistant

## Statut

Accepté le 29 juillet 2026.

## Décision

Les actions administratives sensibles sont enregistrées dans
`admin_audit_logs` avec leur type, résultat, ressource, métadonnées non
sensibles et horodatage. Les valeurs `.env`, clés API, cookies et secrets ne
sont jamais conservés.

Le journal est consultable sur `/admin/audit` et par l’API protégée
`GET /api/v1/admin/audit`. La migration Alembic `0002_admin_audit_log` crée la
table et ses index.

## Conséquences

Les opérations d’administration deviennent traçables sans exposer les
identifiants. La table est ajoutée au schéma de production et doit être
présente avant le démarrage de l’API.
