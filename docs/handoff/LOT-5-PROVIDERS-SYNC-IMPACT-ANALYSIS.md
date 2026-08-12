# Lot 5 — Analyse d'impact Fournisseurs et synchronisation

Date : 2026-08-12

Statut : `phase-0-specification-complete-awaiting-maintainer-validation`

## 1. Résumé

Le Lot 5 est une extension majeure mais peut rester additive et réversible. Le
principal risque n'est pas l'appel HTTP : c'est la coexistence entre l'identité
fournisseur historique portée directement par `championships`/`events`, les
corrections transactionnelles, les quotas partagés et la reprise exacte.

La stratégie retenue ajoute d'abord le nouveau graphe fournisseur, conserve les
colonnes historiques et ne bascule l'ingestion qu'après backfill non ambigu et
validation. Aucun code applicatif, SQL ou composant UI n'est modifié en Phase 0.

## 2. Inventaire de la baseline Lot 4.4

### Persistance

- `championships` porte aujourd'hui `sync_enabled`, `provider_key` et
  `external_id` ; ce modèle ne sait représenter ni plusieurs instances ni une
  source config propre à chaque lien ;
- `events` porte `provider_key`, `external_id` et un index unique partiel ;
- `event_corrections` sépare source et override par champ ;
- `admin_audit_log` fournit acteur, requête et avant/après ;
- `0004_sessions` reste compatible mais l'ADR-0013 désigne l'Événement comme
  Session métier ;
- `0006_admin_console_authentication` protège la console par session humaine,
  CSRF et HMAC technique parallèle ;
- `schema_migrations` et le service Docker `migrate` imposent une évolution
  versionnée avant l'API.

### API et interface

- `/api/v1/events` joint `championships` et filtre déjà `c.active=true` ;
- les routes admin sont globalement protégées ;
- les mutations historiques de championnats utilisent encore la route mixte
  `/api/v1/championships` et exposent des champs techniques à retirer du futur
  formulaire Fournisseurs sans casser leur contrat ;
- le tableau de bord renvoie encore `synchronizationsToday: 0` ;
- aucune page Fournisseurs Lot 5 ni aucun moteur TypeScript n'existe ;
- les scripts Python historiques de production restent une référence de
  comportement, pas une dépendance à incorporer silencieusement au moteur.

## 3. Impacts par composant

### `infra/postgres`

Impact élevé et additif : cinq groupes de migrations proposés. Les anciennes
colonnes ne sont pas supprimées. Les conversions historiques produisent des
liens inactifs et n'effectuent aucun appel réseau. Chaque DOWN refuse une perte
de données et la réapplication est obligatoire dans les recettes.

### `packages/types`

Nouveaux types : schémas de formulaires, instance, lien championnat, quota,
flux, run, mapping et alerte. Les représentations publiques existantes ne sont
pas modifiées. Les JSON d'adaptateur restent paramétrés et ne deviennent pas un
grand type union universel.

### `apps/api`

Nouveaux modules futurs : registre d'adaptateurs, chiffrement, providers,
scheduler, quotas, normalisation, logs/alertes et routes admin. Les services
transactionnels de corrections doivent être réutilisés, non dupliqués.
L'identité d'audit d'un worker est technique et limitée au provider concerné ;
elle n'usurpe pas l'administrateur humain.

Le démarrage vérifie les nouvelles migrations en lecture seule. Aucun scheduler
ne démarre si schéma, clé maître ou limites sûres requises sont absents. Les
workers doivent pouvoir être séparés de l'API dans Docker afin qu'une montée en
charge ou une panne fournisseur ne bloque pas les requêtes HTTP.

### `apps/web`

Impact futur limité au sous-lot 5.9 : navigation Fournisseurs, overview,
détail et onglets. Les composants MEDS, l'AuthProvider, le client cookie/CSRF,
les référentiels et les patterns de pagination sont réutilisés. Aucun secret ne
rejoint l'état React ; après sauvegarde, seul `configured=true` subsiste.

### Docker et exploitation

Le compose devra ajouter un service worker/scheduler partageant l'image API,
la base et la clé maître, avec santé et arrêt gracieux. La concurrence par
instance reste une donnée métier contrôlée en base, pas un simple nombre de
replicas. Les logs JSON restent sur stdout et un volume optionnel peut être
monté. Sauvegarde/restore doivent inclure toutes les nouvelles tables et les
assets locaux de logos.

### Observabilité

Les métriques futures doivent rester à cardinalité bornée : runs, erreurs,
requêtes, quotas et leases par instance/lien, sans external ID d'Événement dans
les labels. Les logs portent request/run/stream IDs mais jamais secret, cookie
ou payload brut sensible. Les alertes métier résident en PostgreSQL ; Grafana
reste une vue technique complémentaire.

## 4. Compatibilité et transition des données

### Championnats existants

Chaque `provider_key` historique distinct peut devenir une instance importée
en état `draft` ou `paused`. Chaque championnat associé devient un lien
`configured/inactive` avec son `external_id`. L'ancien booléen `sync_enabled`
ne déclenche pas automatiquement le scheduler : une activation explicite est
requise après validation du secret, de la source config et des quotas.

Le backfill doit produire un rapport des clés inconnues et des configurations
incomplètes. Il ne fabrique pas d'endpoint depuis un slug sans validation de
l'adaptateur.

### Événements existants

Un Événement n'obtient `provider_championship_id` que si son championnat et sa
clé fournisseur désignent un lien unique. Sinon la colonne reste nulle, une
alerte/migration report est créée et l'ancienne identité continue à fonctionner.
L'index historique reste jusqu'à preuve que tous les consommateurs utilisent la
nouvelle identité.

### Corrections

Les lignes `event_corrections` ne changent pas de sémantique. Lors du backfill,
leur `provider_key` historique reste intact. L'ingestion Lot 5 appelle le même
service de réconciliation sous verrou Événement ; le hash source ne contient
jamais l'override. Aucun backfill ne résout ou supprime une correction.

### Sessions compatibles

Le moteur cible `events.session_title` et les autres champs Événement. Il ne
crée pas de sous-sessions dans `sessions`. Les routes/tables Sessions restent
disponibles tant qu'une décision de suppression dédiée n'existe pas.

## 5. Impact de la configuration par championnat

La source config séparée est indispensable :

```text
provider_instances (OCBlackTop)
  + provider_championships (F1)
      + source_config {strategy: standard, ...}
  + provider_championships (WRC)
      + source_config {strategy: season-path, ...}
```

Le partage du secret/quota au niveau instance garantit que WRC ne double pas le
budget OCBlackTop. L'état flux au niveau lien garantit que WRC ne partage ni
curseur ni lease avec F1. Cette séparation évite aussi un schéma spécifique à
WRC et couvre un futur troisième mode d'accès.

## 6. Impact sécurité

### Menaces principales

- fuite de clés API via réponse, log, audit, erreur ou fixture ;
- réutilisation de nonce ou mauvaise rotation de clé ;
- SSRF via base URL/endpoint administrable ;
- path traversal ou contenu actif via upload de logo ;
- abus de `sync-now` pour épuiser le quota ;
- payload fournisseur volumineux ou malformé ;
- lecture de logs non bornée ;
- worker doté de privilèges administrateur généraux.

### Mesures requises

- chiffrement authentifié et clé maître versionnée dans l'environnement ;
- URLs validées par adaptateur, protocoles HTTPS, politique d'hôtes et blocage
  des plages privées sauf configuration de test explicite ;
- taille/temps maximum des réponses, schéma strict et redaction avant log ;
- commandes manuelles soumises aux mêmes quotas et audit ;
- MIME détecté depuis les octets, noms serveur et stockage hors chemin libre ;
- identité de worker restreinte, transactions et requêtes paramétrées ;
- tests de recherche de secrets dans logs, base d'audit, réponses et artefacts.

## 7. Impact performance et capacité

Les index d'acquisition portent `state`, `next_eligible_at` et lease ; les runs
portent instance/lien/date. Les écritures inchangées sont évitées par hash.
Le scheduler récupère une unité bornée par transaction et ne maintient aucun
verrou pendant un appel HTTP : il acquiert un lease, appelle hors transaction,
puis verrouille et commite si le lease est toujours sien.

La taille des curseurs/source configs est bornée dans l'application. Les logs
détaillés ne résident pas intégralement en PostgreSQL ; seuls les résumés de
runs et alertes sont durables. Les listes admin sont filtrées et paginées avant
LIMIT/OFFSET conformément aux décisions existantes.

## 8. Impact disponibilité et reprise

- arrêt API : le worker peut continuer si la base est disponible ;
- arrêt worker : aucune perte, leases expirent et curseurs restent ;
- arrêt PostgreSQL : aucune progression n'est considérée acquise ;
- crash après réponse fournisseur avant commit : unité rejouée, idempotence ;
- crash après commit : curseur et données avancent ensemble, pas de rejeu
  nécessaire hormis reprise idempotente ;
- quota reset pendant arrêt : état recalculé à la reprise ;
- clé maître absente/invalide : fournisseur suspendu, API publique existante
  continue à servir les données déjà stockées.

## 9. Impact API publique et clients

Aucun champ, type ou chemin `/api/v1` n'est retiré. L'exclusion utilise le join
sur `championships.active`. Une pause de flux ou de fournisseur ne modifie pas
la visibilité ; seule une désactivation métier explicite du championnat la
modifie. Une réactivation rend immédiatement les données publiées éligibles,
puis demande un rafraîchissement current prioritaire.

Les clients MyBB, mobile et tiers continuent à recevoir les mêmes
représentations effectives. Les événements absents ne disparaissent pas. Les
identités, quotas, source configs, mappings et alertes sont strictement admin.

## 10. Impact migrations et rollback

| Migration proposée | Risque | Protection |
|---|---|---|
| M1 instances/secrets/quotas | clé/config incomplète | aucune activation, DOWN refuse données |
| M2 liens/source configs | association héritée ambiguë | liens inactifs, rapport, colonnes conservées |
| M3 streams/runs | lease/run actif au DOWN | pause, expiration, refus tant que données actives |
| M4 identité/mappings/présence | collisions externes | diagnostic préalable, index après résolution |
| M5 alertes/assets | fichiers hors DB | manifeste/export et refus de DOWN destructif |

Le rollback applicatif garde un mode de lecture des anciennes colonnes pendant
tout le Lot 5. Une migration n'efface jamais un secret, run, mapping, correction
ou asset sans procédure explicite et sauvegarde. Le ZIP/release doit inclure les
scripts UP/DOWN et la vérification de schéma correspondante.

## 11. Jeux de données et environnements de recette

Le générateur Lot 5 devra créer au minimum :

- deux instances, dont une sans quota sûr ;
- OCBlackTop synthétique avec F1 et WRC sur stratégies distinctes ;
- TheSportsDB synthétique avec `league_id` ;
- championnats découvert, actif, désactivé, suspendu et en erreur ;
- saisons courante, historique, vide confirmée et page vide intermédiaire ;
- quota presque épuisé, réserve current et reset proche ;
- curseur composé, lease expiré et run interrompu ;
- mapping confirmé, ambiguïté, collision et Événement absent deux/trois cycles ;
- override local divergent et cas de convergence ;
- secrets factices, jamais réels ;
- alertes et runs pour toutes les issues principales.

Les faux providers sont locaux, déterministes et capables d'injecter 429, 5xx,
timeout, 401, headers de quota, pagination et crash simulé. Les commandes de
nettoyage suppriment uniquement la pile/les volumes nommés du test.

## 12. Risques résiduels et arbitrages

| Risque | Niveau | Réponse |
|---|---|---|
| formats réels fournisseurs différents des hypothèses | élevé | contrat extensible + fixtures issues de docs officielles avant adaptateur |
| cadence incorrecte sous headers incomplets | élevé | politique conservatrice, limites configurées distinctes, quota inconnu bloque |
| migration d'identité ambiguë | élevé | backfill seulement certain, rapport et mapping manuel |
| concurrence corrections/sync | élevé | verrou Événement et transaction existante réutilisés |
| croissance des runs/logs | moyen | pagination, index, politique de rétention distincte, volume rotatif |
| SSRF par configuration | élevé | allowlist/politique d'hôte adaptateur et validation réseau |
| upload SVG actif | moyen | SVG exclu de la proposition V1 |
| ancien schéma Sessions confus | moyen | ADR-0013 rappelé, moteur cible Événements uniquement |
| service Python historique divergent | moyen | tests de compatibilité, pas de couplage runtime implicite |

## 13. Documentation permanente

La Phase 0 ne modifie pas le Handbook ni ne crée d'ADR permanent : elle propose
des décisions de lot encore soumises à audit. Après validation du mainteneur et
avant 5.1, les décisions durables retenues devront être consignées ensemble
dans `PROJECT-HANDBOOK.md`, `docs/handbook/DECISIONS.md`,
`docs/handbook/CHANGELOG.md` et un ADR Fournisseurs/synchronisation.

## 14. Conclusion

Le Lot 5 est réalisable sans rupture de contrat ni migration destructive si le
nouveau modèle est introduit par couches, si aucune activation n'est implicite
et si l'identité historique reste disponible pendant la transition. Les
principaux critères de sécurité et de reprise sont testables indépendamment
avant l'interface.

**NO APPLICATION CODE IMPLEMENTED**
