# Modèle de domaine v6.1

```text
Discipline
└── Championship
    ├── Season (categoryId = null)
    │   └── Event
    │       └── Session
    └── Category (facultative)
        └── Season (categoryId renseigné)
            └── Event
                └── Session
```

`Season.championshipId` est obligatoire. `Season.categoryId` est nullable. Lorsqu'il est renseigné,
la catégorie doit appartenir au championnat de la saison.

Le terme fonctionnel français **Épreuve** correspond à l'entité technique `Event`.
