# 8.1.0-alpha.2-lot.4

Cette révision corrige exclusivement le validateur local du lot 3.

## Erreur corrigée

```text
SyntaxError: Invalid or unexpected token
console.log('
```

La cause était un retour à la ligne littéral placé à l'intérieur d'une chaîne
JavaScript délimitée par des apostrophes.

## Test

Depuis le dossier `scripts` :

```cmd
test-lot3.cmd
```

Résultat attendu :

- Docker Compose accessible ;
- API health OK ;
- création d'un championnat temporaire ;
- modification OK ;
- suppression OK ;
- disparition confirmée dans la liste finale.
