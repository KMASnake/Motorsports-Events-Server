# 8.1.0-alpha.2-lot.4

Cette révision corrige le validateur du lot 3 lorsque celui-ci appelle :

```http
DELETE /api/v1/championships/:id
```

Le validateur envoyait `Content-Type: application/json` sans corps. Fastify
refusait alors la requête avec :

```text
FST_ERR_CTP_EMPTY_JSON_BODY
```

Le header est désormais ajouté uniquement pour les requêtes qui contiennent
réellement un corps.

## Test

Depuis le dossier `scripts` :

```cmd
test-lot3.cmd
```

Résultat attendu :

```text
Création OK
Modification OK
Suppression OK
Liste finale OK
```
