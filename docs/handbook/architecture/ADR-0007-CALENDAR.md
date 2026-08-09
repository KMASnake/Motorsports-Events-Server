# ADR-0007-CALENDAR

Statut : Accepté

## Décision

Le calendrier reste la vue principale des événements. La vue Liste secondaire
est paginée côté interface par blocs de 25 événements. Elle trie par défaut les
événements selon la distance absolue entre leur date de début et l'instant
courant afin de présenter immédiatement l'événement temporellement le plus
proche. Les en-têtes Date, Événement, Championnat, Circuit, Statut et API sont
interactifs. Date alterne entre chronologie croissante et décroissante ; les
autres colonnes alternent entre ordre alphabétique croissant et décroissant.

## Conséquences

Le changement de page ne modifie ni les filtres partagés ni le calendrier. Un
changement de filtre revient à la première page. En cas d'égalité de proximité,
la date chronologique puis le nom assurent un ordre déterministe. Le tri est
effectué avant la pagination et un changement de tri revient à la première
page.

La création d'une plage utilise deux dates explicites et préremplit début et
fin. Les déplacements et redimensionnements sont optimistes, mais l'interface
restaure obligatoirement l'état antérieur si la persistance échoue. Les durées
sont calculées entre instants UTC pour rester stables lors d'un passage à
minuit ou d'un changement d'heure civile.
