# 8.1.0-alpha.2-lot.4

Cette révision corrige définitivement l’erreur :

```text
Body cannot be empty when content-type is set to 'application/json'
```

## Défense en profondeur

1. Le frontend retire explicitement `Content-Type` lorsqu’il n’y a pas de body.
2. L’API retire ce header sur les requêtes `DELETE`, `GET` et `HEAD` réellement vides.
3. Nginx évite de conserver un ancien `index.html` en cache.

## Test recommandé

```powershell
.\reset-dev.cmd
```

Puis effectuer un rechargement forcé du navigateur avec `Ctrl+F5` avant de
supprimer un championnat temporaire.
