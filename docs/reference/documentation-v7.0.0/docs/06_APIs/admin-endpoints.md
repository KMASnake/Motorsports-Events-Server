# Endpoints administratifs v6.1

- CRUD disciplines, championnats, catégories, saisons, épreuves et sessions ;
- `POST /admin/catalog/manual` pour l'assistant atomique de création manuelle ;
- `POST /admin/provider-mappings` pour rattacher une ressource externe ;
- `POST /admin/synchronizations` pour lancer une synchronisation ;
- `POST /admin/corrections` pour créer une correction.

Les écritures critiques acceptent une clé d'idempotence et produisent un audit.
