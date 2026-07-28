# Intégration du client MyBB

Le plugin MyBB est un client du serveur et ne contacte jamais directement les
providers.

## Configuration minimale

- URL HTTPS du serveur ;
- `PUBLIC_API_KEY` dans l'en-tête `X-API-Key` ;
- sports et types de séances choisis par l'administrateur MyBB ;
- fréquence de synchronisation locale.

## Cycle recommandé

1. appeler `/api/v1/version` et vérifier que l'API v1 est prise en charge ;
2. charger `/api/v1/sports` ;
3. effectuer un chargement initial avec `/api/v1/events` ;
4. conserver le `cursor` retourné par `/api/v1/events/changes` ;
5. appliquer toutes les pages différentielles jusqu'à `has_more=false` ;
6. créer, mettre à jour ou retirer les entrées du calendrier MyBB selon
   `id`, `version` et `deleted`.

Une réponse `503` demande une nouvelle tentative après `Retry-After`. Une
réponse `409` signifie qu'une synchronisation serveur a invalidé la pagination ;
le plugin reprend alors depuis son dernier `since` confirmé.

Le plugin doit conserver les identifiants numériques du serveur. Le texte,
les images et les préférences d'affichage restent des responsabilités du
plugin.

La clé administrateur du serveur ne doit jamais être enregistrée dans MyBB.
