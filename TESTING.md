# Test v8.1.0-alpha.2-lot.4

```powershell
docker compose down -v --remove-orphans
docker compose up --build
docker compose ps
```

Vérifier les trois services `healthy`, ouvrir http://localhost:3000 puis tester la création manuelle d’un événement.
