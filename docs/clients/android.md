# Intégration du client Android

L'application Android consomme uniquement l'API HTTPS du serveur.

## Stockage local

La clé stable d'une séance est son champ `id`. Le stockage local devrait aussi
conserver `version`, `updated_at` et `deleted`.

## Cycle recommandé

1. effectuer une synchronisation complète au premier démarrage ;
2. demander les changements avec le dernier `cursor` ;
3. traiter les pages jusqu'à `has_more=false` ;
4. enregistrer le nouveau curseur de manière atomique après application de la
   page ;
5. sur `503`, attendre `Retry-After` puis recommencer la page ;
6. sur `409`, abandonner les pages non validées et reprendre depuis le dernier
   `since` confirmé ;
7. relancer une synchronisation complète si le serveur refuse durablement le
   curseur.

Le curseur est opaque et ne doit pas être décodé côté Android. Les préférences
de sports, notifications, périodes et types de séances restent locales.

La clé publique doit être protégée autant que possible, mais elle ne remplace
pas une authentification utilisateur. La clé administrateur ne doit jamais
être incluse dans l'application.
