# Pipeline détaillé

## Étape 1 — Planification
Entrées : fournisseur, périmètre, saison, priorité, origine de la demande.

## Étape 2 — Acquisition du verrou
Un seul run actif pour un même fournisseur et un même périmètre logique, sauf
configuration explicite autorisant le parallélisme.

## Étape 3 — Collecte
- appliquer les quotas ;
- gérer pagination ou curseur ;
- enregistrer la réponse brute avant transformation ;
- conserver les métadonnées HTTP utiles ;
- ne jamais journaliser les secrets.

## Étape 4 — Validation
- schéma minimal ;
- présence des identifiants ;
- dates parseables ;
- cohérence temporelle ;
- type d'événement reconnu.

## Étape 5 — Normalisation
- noms canoniques ;
- fuseaux ;
- statuts ;
- pays et villes ;
- catégories de séance ;
- détection course / sprint / qualification sprint.

## Étape 6 — Matching
- référence externe existante ;
- alias ;
- saison et championnat ;
- date et circuit ;
- score de similarité.

## Étape 7 — Fusion
- comparer observation et valeur canonique ;
- respecter les overrides ;
- créer une décision de fusion ;
- ouvrir un conflit lorsque nécessaire.

## Étape 8 — Persistance
Écriture transactionnelle des changements cohérents.

## Étape 9 — Publication
Créer un snapshot si le contenu public a changé et si la politique l'autorise.

## Étape 10 — Finalisation
Compteurs, statut final, audit, métriques, notification.
