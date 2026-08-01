# Écran Journaux

## Objectif
Rechercher et corréler les journaux applicatifs structurés sans exposer de données sensibles.

## Structure
- Barre de recherche plein texte.
- Filtres : période, niveau, service, environnement, correlation_id, utilisateur technique.
- Histogramme des volumes par niveau.
- Tableau virtualisé : heure, niveau, service, message, correlation_id, durée.
- Panneau de détail JSON avec copie sélective.

## Règles
- Pagination par curseur ou virtualisation ; aucune pagination offset volumineuse.
- Les champs sensibles sont masqués côté serveur.
- Recherche bornée dans le temps par défaut à 15 minutes.
- Export soumis à permission et limite de volume.
- Un clic sur correlation_id applique le filtre correspondant.

## États
Flux en direct actif ou suspendu, aucun résultat, requête trop large, syntaxe invalide, rétention dépassée, export en préparation ou échoué.
