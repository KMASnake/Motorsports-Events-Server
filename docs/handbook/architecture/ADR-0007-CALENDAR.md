# ADR-0007-CALENDAR

Statut : Accepté

## Décision

Le calendrier reste la vue principale des événements. La vue Liste secondaire
est paginée côté interface par blocs de 25 événements. Elle trie par défaut les
événements selon la distance absolue entre leur date de début et l'instant
courant afin de présenter immédiatement l'événement temporellement le plus
proche.

## Conséquences

Le changement de page ne modifie ni les filtres partagés ni le calendrier. Un
changement de filtre revient à la première page. En cas d'égalité de proximité,
la date chronologique puis le nom assurent un ordre déterministe.
