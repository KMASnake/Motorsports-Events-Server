# Architecture de synchronisation v6.1

Le pipeline transforme les objets externes en observations, les normalise puis les mappe vers la
hiérarchie canonique Discipline → Championnat → Catégorie facultative → Saison → Épreuve → Session.

Une absence de catégorie chez le fournisseur ne provoque jamais la création automatique d'une
catégorie. La saison est alors directement rattachée au championnat.
