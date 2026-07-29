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

## Règles de l'API v1

Sont compatibles dans `/api/v1` :

- l'ajout d'une route ;
- l'ajout d'un paramètre facultatif ;
- l'ajout d'un champ de réponse ;
- l'ajout d'une valeur documentée à une énumération ouverte.

Nécessitent `/api/v2` :

- le retrait ou le renommage d'un champ ;
- le changement de type d'un champ ;
- la modification de la signification d'un champ existant ;
- le changement d'une valeur par défaut qui retire des données.

Les clients doivent ignorer les champs JSON inconnus et traiter
`deleted=true` comme une suppression logique.

## Versions

- serveur 2.4.x : API v1 historique avec synchronisation par `since` ;
- serveur 2.5.x : API v1, curseur différentiel recommandé et schémas OpenAPI
  explicites.
- serveur 2.6.x : API v1, administration de la qualité temporelle et de la
  configuration ;
- serveur 2.7.0-alpha.1 : API v1 inchangée, migrations de schéma Alembic.
- serveur 2.7.0-alpha.2 : API v1 inchangée, tests providers et couverture CI.
- serveur 2.7.0-alpha.3 : API v1 inchangée, tests PostgreSQL isolés.
- serveur 2.7.0-alpha.4 : API v1 et routes admin inchangées, routeurs
  d’administration isolés de `app.main`.
- serveur 2.7.0-alpha.5 : API v1 inchangée, journal d’administration et
  révision de schéma `0002_admin_audit_log`.
- serveur 2.7.0-alpha.6 : API et schéma inchangés, logs structurés JSON.
- serveur 2.7.0-alpha.7 : API et schéma inchangés, rotation des logs Docker.
- serveur 2.7.0-alpha.8 : API et schéma inchangés, sauvegardes automatisées.
