# Champs et entités corrigeables v6.1

Entités : discipline, championnat, catégorie, saison, épreuve, session, circuit et lieu.

La correction d'une relation structurante (`disciplineId`, `championshipId`, `categoryId`, `seasonId`)
requiert une validation renforcée. Définir `categoryId` à `null` est autorisé et rattache la saison
directement au championnat.
