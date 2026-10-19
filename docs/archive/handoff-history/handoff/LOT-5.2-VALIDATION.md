# Lot 5.2 — Secrets et configuration fournisseur

Date : 2026-08-12

## Périmètre

Le sous-lot ajoute exclusivement le backend de configuration d’une instance
fournisseur, le stockage chiffré de ses credentials et sa politique de quota
configurative. Il ne contient ni adaptateur réseau réel, ni test de connexion,
ni découverte, ni moteur de quota, ni synchronisation, ni scheduler, ni UI.

La configuration globale de l’instance reste séparée de
`provider_championship_source_configs`, qui appartient au lien
fournisseur–championnat et sera exploitée dans un sous-lot ultérieur.

## Architecture des secrets

- algorithme : AES-256-GCM fourni par `node:crypto` ;
- nonce aléatoire de 96 bits généré pour chaque écriture ;
- tag GCM de 128 bits concaténé au ciphertext ;
- AAD : version, UUID fournisseur et nom logique du secret ;
- `key_version` conservée avec chaque ligne ;
- lecture possible avec les anciennes clés déclarées ;
- toute nouvelle écriture utilise la version active ;
- remplacement atomique par `UPSERT` ;
- déchiffrement réservé au service interne d’adaptateur ;
- aucune route ne retourne le plaintext.

Les clés maîtres proviennent uniquement de l’environnement :

```text
PROVIDER_MASTER_KEYS={"1":"<clé AES-256 encodée en base64>"}
PROVIDER_ACTIVE_KEY_VERSION=1
```

`.env.example` contient volontairement une valeur illustrative invalide, jamais
une clé utilisable. Une configuration absente désactive sûrement les opérations
cryptographiques ; une configuration présente mais invalide fait échouer le
démarrage. Aucune clé n’est générée silencieusement.

## Configuration fournisseur

La création et la modification valident `adapter_key` dans le registre puis le
JSON de configuration avec l’adaptateur. Une défense générique refuse aussi
toute clé sensible (`api_key`, `secret`, `token`, `password`, etc.) dans ce JSON
non secret. Concurrence par défaut : 1 ; réserve année courante : 30 %.

La politique de quota sait représenter une limite configurée, observée par le
fournisseur ou hybride, ainsi que l’absence de limite. Aucun calcul de cadence
ou de consommation runtime n’est implémenté.

## API d’administration

- `GET /api/v1/admin/providers`
- `POST /api/v1/admin/providers`
- `GET /api/v1/admin/providers/:id`
- `PATCH /api/v1/admin/providers/:id`
- `PUT /api/v1/admin/providers/:id/secrets/:name`
- `DELETE /api/v1/admin/providers/:id/secrets/:name`
- `GET /api/v1/admin/providers/:id/quota-policy`
- `PUT /api/v1/admin/providers/:id/quota-policy`

Ces routes héritent de l’authentification administrateur Lot 4.4. Les mutations
par session humaine exigent le contrôle Origin et le jeton CSRF ; le Bearer
HMAC technique reste compatible. Les réponses fournisseur contiennent
uniquement `{name, configured, updated_at}` pour les secrets.

## Audit et redaction

Création, changement de configuration, configuration/remplacement/suppression
de secret et politique de quota sont audités dans la même transaction. Le
payload d’audit est expurgé récursivement et ne contient jamais le secret. Les
erreurs de clé ou d’authentification GCM sont génériques.

## Validation exécutée

```sh
npm run lint
npm run typecheck
npm test
npm run build
./scripts/test-lot52-secrets.sh
./scripts/validate-repository.sh
```

Résultats :

- 131 tests Node réussis : 102 API et 29 web ;
- 9 tests unitaires secrets, 4 tests de routes et 8 tests contrats : OK ;
- lint, typecheck et builds API/Web/types : OK ;
- recette PostgreSQL/Docker : chiffrement, lecture, remplacement, v1→v2,
  configuration quota, audit et redaction : OK ;
- sentinelle `SUPER_SECRET_SENTINEL_5_2` absente de la base d’audit, des réponses
  et des représentations fournisseur : OK.

### Real integration sentinel test

La recette `npm run test:lot52` traverse réellement :

```text
Fastify inject HTTP
→ routes /api/v1/admin/providers réelles
→ authentification administrateur réelle
→ ProviderConfigurationService réel
→ ProviderSecretCipher réel
→ PostgreSQL réel
→ admin_audit_log réel
```

Elle écrit successivement `SUPER_SECRET_SENTINEL_5_2_A` avec la clé active v1,
puis `SUPER_SECRET_SENTINEL_5_2_B` avec une trousse v1+v2 active v2. Elle
vérifie une seule ligne active, des nonce et ciphertext différents, la lecture
de l’ancienne version, puis `key_version=2` après remplacement.

Les corps HTTP, le JSON fournisseur, `admin_audit_log.old_value/new_value`,
`provider_instances.config`, `provider_quota_policies` et les erreurs
sérialisées sont inspectés et ne contiennent aucune sentinelle. Le ciphertext
n’est jamais affiché par le test. Les audits `provider.secret_configured`,
`provider.secret_replaced` et `provider.secret_removed` sont présents avec des
métadonnées uniquement.

Une altération directe du ciphertext PostgreSQL provoque un
`ProviderMasterKeyError` contrôlé sans révéler clé, secret, ciphertext, nonce ou
AAD. La valeur chiffrée saine est restaurée uniquement pour terminer la recette.

Sans variables de clé, une seconde application réelle conserve GET, POST et
PATCH fournisseur, retourne 503 sur PUT secret, refuse la lecture interne et
n’écrit aucune ligne plaintext. Les configurations partielles ou invalides
(JSON, version absente/inconnue/invalide, base64 invalide et taille différente
de 32 octets) échouent sûrement ; aucune clé par défaut n’est générée.

## Recette VPS

```sh
cd /home/debian/motorsports-events-server-lot42-test
git switch codex/lot-5-providers-sync
git pull --ff-only origin codex/lot-5-providers-sync

sudo env \
  LOT52_PROJECT=mse-lot52-secrets-vps \
  LOT52_POSTGRES_PORT=55472 \
  ./scripts/test-lot52-secrets.sh
```

Résultat attendu : `Tests Lot 5.2 secrets et configuration : OK`.

## État et reports

Le sous-lot 5.2 est implémenté et attend l’audit mainteneur. Les adaptateurs
réels, test de connexion, découverte, source config championnat, moteur de
quota, scheduler, synchronisation et interface sont reportés à 5.3+.
