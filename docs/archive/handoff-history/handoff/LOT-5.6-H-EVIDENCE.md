# Lot 5.6-H — preuves de l’interface ACP

Date : 2026-08-21

Start SHA : `0db8912c14ba31676b71578a28265394c053e495`

Final implementation SHA : `5b2a9109682dc8da768108094a1698837d7c4465`
Statut : **PASS FOR MAINTAINER AUDIT**

## Périmètre livré

La route ACP existante `/synchronizations` expose désormais une supervision
opérateur de l’acquisition provider/championship sans nouvelle navigation ni
logique métier frontend. Elle présente les volets Current, Finalization et
History, les runs récents, anomalies et détails source. Corrections et
observations restent visuellement et sémantiquement séparées.

Composants principaux :

- `ProviderAcquisitionPage.tsx` : page, états UX, filtres, détail modal,
  formulaires et actions ;
- `acquisitionApi.ts` : client typé réutilisant cookies, CSRF et session ACP ;
- `provider-acquisition.spec.ts` : preuve navigateur desktop/mobile ;
- styles ACP ajoutés au design system existant.

## API 5.6-G consommées

- `GET /api/v1/admin/provider-championships/:id/acquisition`
- `GET /api/v1/admin/provider-acquisition/anomalies`
- `GET /api/v1/admin/provider-source-entities/:id`
- `PUT /api/v1/admin/provider-source-entities/:id/corrections/:fieldPath`
- `POST /api/v1/admin/provider-source-corrections/:id/deactivate`
- `PUT /api/v1/admin/provider-source-entities/:id/observations/:key`
- `POST /api/v1/admin/provider-source-entities/:id/resync`
- `POST /api/v1/admin/provider-championships/:id/acquisition/resync-season`
- `POST /api/v1/admin/provider-championships/:id/acquisition/resume-history`
- `POST /api/v1/admin/provider-championships/:id/acquisition/rebuild-history`

La sélection provider/championship utilise aussi les listes ACP existantes
`GET /admin/providers` et `GET /admin/providers/:id/discoveries`.

## Matrice d’acceptation H01–H26

| ID | Preuve | Statut |
|---|---|---|
| H01 | page acquisition rendue sur la route protégée | PASS |
| H02 | état de chargement explicite | PASS |
| H03 | erreur lisible et bouton Réessayer | PASS |
| H04 | états vides association/anomalies/runs | PASS |
| H05 | états Current, Finalization, History et runs affichés | PASS |
| H06 | liste anomalies rendue | PASS |
| H07 | filtres state/type bornés aux valeurs valides | PASS |
| H08 | détail entité source en modale | PASS |
| H09 | corrections séparées de la source | PASS |
| H10 | observations séparées des corrections | PASS |
| H11 | création correction par PUT | PASS |
| H12 | mise à jour correction par PUT et révision | PASS |
| H13 | désactivation confirmée, aucun DELETE | PASS |
| H14 | création observation par PUT | PASS |
| H15 | mise à jour observation par PUT | PASS |
| H16 | resync event | PASS |
| H17 | resync season avec confirmation explicite | PASS |
| H18 | resume history | PASS |
| H19 | rebuild history avec confirmation explicite | PASS |
| H20 | session ACP réutilisée, 401/403 traduits sans fuite | PASS |
| H21 | refus 409 traduit en message opérateur | PASS |
| H22 | actions absentes de `allowed_actions` désactivées | PASS |
| H23 | overview, anomalies ou détail rafraîchis après mutation | PASS |
| H24 | frontière ACP existante respectée : sessions humaines administrateur uniquement ; aucun rôle viewer inventé | PASS |
| H25 | aucun `source_data` brut reconstruit ou affiché | PASS |
| H26 | aucune API, donnée ou fonction 5.7 | PASS |

Total : **26 PASS, 0 PARTIAL, 0 FAIL, 0 NOT TESTED**.

## Exécutions

- `npm --workspace @mse/web run typecheck` : PASS
- `npm --workspace @mse/web run lint` : PASS
- `npm --workspace @mse/web test -- --run` : PASS, 42/42
- `npm --workspace @mse/web run build` : PASS
- Playwright Chromium officiel : PASS, 4/4
- `npm --workspace @mse/api test -- providerAcquisitionAdminRoutes.test.ts` : PASS, 3/3
- `npm --workspace @mse/api test` : PASS, 209/209
- `./scripts/test-lot56-corrections-observations.sh` : PASS sur PostgreSQL réel

Captures :

- `tests/ui/screenshots/provider-acquisition-1440x900.png`
- `tests/ui/screenshots/provider-acquisition-mobile-390x844.png`

## Sécurité, responsive et risques

La page reste derrière `ProtectedConsole`, et les mutations réutilisent les
cookies ACP et le jeton CSRF. Les actions suivent `allowed_actions`; le backend
reste l’autorité finale. Les dispositions 1440 px et 390 px sont couvertes et
les contrôles principaux restent utilisables au clavier.

Risque résiduel non bloquant hérité de 5.6-G : une query anomalies invalide
retourne `[]` plutôt que 400. L’UI ne produit que les filtres valides. Aucun
backend, schéma, migration, modèle final métier ou périmètre 5.7 n’a été modifié.
