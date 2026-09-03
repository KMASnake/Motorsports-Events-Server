# 8.1.0-alpha.2-lot.4

Cette révision corrige :

```text
TS2552: Cannot find name 'options'
TS2304: Cannot find name 'body'
```

La fonction HTTP partagée de la page Championnats utilise désormais uniquement
le paramètre `init: RequestInit`.

Le header JSON est ajouté seulement si `init.body` est défini. Une suppression
`DELETE` sans corps ne transmet donc plus `Content-Type: application/json`.
