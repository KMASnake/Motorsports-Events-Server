# Migrations v6.1

1. créer `disciplines` et injecter les huit codes officiels ;
2. ajouter `discipline_id` aux championnats et renseigner chaque ligne ;
3. créer `categories` ;
4. ajouter `category_id` nullable aux saisons ;
5. renommer la table technique `rounds` en `events` et `round_id` en `event_id` ;
6. créer les contraintes composites et index partiels ;
7. ajouter `origin` et `provider_mappings` ;
8. migrer les API et projections ;
9. vérifier les comptages et relations avant suppression des compatibilités temporaires.

Aucune migration ne doit inventer une catégorie pour les saisons existantes : elles restent directes.
