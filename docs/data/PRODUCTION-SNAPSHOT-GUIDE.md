# Guide de snapshot de production

L'export est une action manuelle en lecture seule. Le dump custom PostgreSQL
reste hors Git. L'import refuse `NODE_ENV=production`, les hôtes connus de
production et restaure d'abord dans une base temporaire. La base temporaire
n'est conservée qu'après anonymisation et vérification bloquante.

```powershell
$env:PRODUCTION_DATABASE_URL = Read-Host -AsSecureString
.\scripts\data\export-production.ps1
.\scripts\data\reset-from-production-snapshot.ps1 -DumpFile C:\backups\snapshot.dump
```

Supprimer les snapshots dès la fin de la campagne et renouveler au maximum à
chaque jalon nécessitant une densité réaliste.
