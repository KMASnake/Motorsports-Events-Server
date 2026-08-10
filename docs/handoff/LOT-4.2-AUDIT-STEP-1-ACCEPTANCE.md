# Recette — remédiation audit Lot 4.2, étape 1

## Objet

Valider sur une base PostgreSQL Docker isolée que les migrations sont
versionnées, idempotentes et réversibles, et que le démarrage de l'API ne
modifie aucune donnée métier.

## Commande VPS

```bash
sudo env \
  STEP1_PROJECT=mse-lot42-migrations-vps \
  STEP1_POSTGRES_PORT=55450 \
  STEP1_API_PORT=3441 \
  STEP1_WEB_PORT=3440 \
  ./scripts/test-lot42-migrations.sh
```

## Résultat attendu

```text
Versions : 0001_event_corrections,0002_utc_storage,0003_admin_audit_and_provider_identity
Rollback et restauration : OK
Empreinte inchangée après deux redémarrages API : <empreinte>
Tests des migrations Lot 4.2 étape 1 : OK
```

Le script couvre une base vierge, une seconde exécution idempotente, une
ancienne correction de fuseau, son archivage, son rollback, sa restauration
et deux redémarrages API. Il détruit uniquement son projet Docker isolé à la
fin du test.

Ne jamais lancer manuellement un rollback sur une base de production.
