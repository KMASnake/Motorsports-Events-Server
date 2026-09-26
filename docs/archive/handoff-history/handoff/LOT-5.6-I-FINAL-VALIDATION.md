# Lot 5.6-I — validation finale

Date : 2026-08-21  
Branche : `codex/lot-5-providers-sync`  
START_SHA : `6c04dcc30ed13fac68259cff0eb65b0fbaf9a191`  
SHA des corrections de preuve : `a5c217d707fd67d82a2914647ebd48cf6cb1a377`

## Verdict

PASS. La recette finale couvre le périmètre technique 5.6-A à 5.6-H sans
modifier de fonctionnalité métier. Le Lot 5.6 global reste non validé jusqu’à
une décision explicite du mainteneur. La fusion dans `main`, 5.7, 5.7-P et les
lots ultérieurs restent non autorisés.

## Inventaire consolidé

| Sous-lot | Objet | État avant 5.6-I | Preuve |
|---|---|---|---|
| 5.6-A | Persistance et contrats source | Validé mainteneur | `LOT-5.6-A-VALIDATION.md` |
| 5.6-B | Acquisition sécurisée des adaptateurs | Validé mainteneur | `LOT-5.6-B-VALIDATION.md` |
| 5.6-C | Transaction d’unité durable | Validé mainteneur | `LOT-5.6-C-VALIDATION.md` |
| 5.6-D | Orchestration durable | Validé mainteneur | `LOT-5.6-D-VALIDATION.md` |
| 5.6-E | Temporalité et finalization | Validé mainteneur | `LOT-5.6-E-VALIDATION.md` |
| 5.6-F | Protection corrections/observations | Validé mainteneur | `LOT-5.6-F-EVIDENCE.md` |
| 5.6-G | API et actions ACP | Validé mainteneur | `LOT-5.6-G-EVIDENCE.md` |
| 5.6-H | Interface ACP | Validé mainteneur | `LOT-5.6-H-EVIDENCE.md` |

## Résultats de recette

| ID | Contrôle | Résultat |
|---|---|---|
| F56I-01 | Fondation PostgreSQL sur base neuve | PASS |
| F56I-02 | Refus du rollback destructif implicite | PASS |
| F56I-03 | Rollback 0023 vers 0016 puis réapplication | PASS |
| F56I-04 | Schéma et huit versions 0016–0023 après réapplication | PASS |
| F56I-05 | Stockage source, 6/6 | PASS |
| F56I-06 | Acquisition adaptateurs, 72/72 | PASS |
| F56I-07 | Transaction PostgreSQL, replay et idempotence | PASS |
| F56I-08 | Checkpoint, fencing, absence, overrides et secrets | PASS |
| F56I-09 | Orchestration current jusqu’à épuisement futur | PASS |
| F56I-10 | Priorité, historique et finalization | PASS |
| F56I-11 | Dates pré-1970 et frontières temporelles | PASS |
| F56I-12 | Temporalité T+29, T+30 et après T+30 | PASS |
| F56I-13 | États completed, cancelled et postponed | PASS |
| F56I-14 | Reprise finalization dans un second processus | PASS |
| F56I-15 | Corrections/observations, concurrence et replay | PASS |
| F56I-16 | Stale worker, crash, provenance et reprise inter-processus | PASS |
| F56I-17 | Régression scheduler 5.4, 8/8 | PASS |
| F56I-18 | Régression quota/cadence 5.5, 61 cas | PASS |
| F56I-19 | Requêtes fournisseur réelles et crédits consommés | PASS — 0/0 |
| F56I-20 | API typecheck, lint et build | PASS |
| F56I-21 | API, 209/209 tests | PASS |
| F56I-22 | Web typecheck, lint, build et 42/42 tests | PASS |
| F56I-23 | Chromium, 17/17, zéro échec et zéro skip | PASS |
| F56I-24 | Sécurité API 52/52, CSP Nginx et API publique | PASS |
| F56I-25 | Frontière 5.7 et contrats `/api/v1` inchangés | PASS |
| F56I-26 | Validation dépôt et release extraite | PASS |

Les corrections nécessaires à la preuve sont limitées au rollback/réapplication
complète des migrations 0016–0023 et à deux attentes Playwright devenues
historiques ou ambiguës. Aucun fichier de migration, API publique, modèle
métier, entitlement ou mécanisme de réconciliation 5.7 n’a été modifié.

## Release

- archive : `dist/motorsports-events-server-2.7.0.zip` ;
- SHA-256 : `0e77e999751eb0fed76cd2866901ba7cb75287f1e3d69ff545045913b413237e` ;
- vérification `.sha256` : PASS ;
- extraction dans un répertoire jetable et `validate-repository.sh` depuis le
  contenu extrait : PASS.

## Observations non bloquantes

- P2 : aucun constat ouvert ;
- P3 hérité de 5.6-G : une query anomalies invalide retourne `[]` plutôt qu’un
  HTTP 400 explicite. Ce constat ne rouvre aucun sous-lot validé.

## Gate suivant

Décision mainteneur uniquement : valider ou refuser globalement le Lot 5.6.
Jusqu’à cette décision, `sub_lot_5_6.maintainer_validated=false`,
`merge_authorized=false`, `authorized_technical_sub_lot=null`, et 5.7,
5.7-P ainsi que les lots ultérieurs restent non autorisés.
