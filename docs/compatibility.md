# Compatibilité des clients

Les clients doivent déclarer la plage de versions d’API qu’ils prennent en
charge.

Exemple :

```text
Plugin MyBB 2.x
API serveur prise en charge : >= 1.0 et < 2.0
```

Le serveur ne doit pas introduire de rupture dans `/api/v1` sans créer une
nouvelle version majeure de l’API.
