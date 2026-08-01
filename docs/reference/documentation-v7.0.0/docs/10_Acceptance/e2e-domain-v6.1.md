# Parcours E2E du modèle v6.1

## E2E-61-01 — Championnat sans catégorie
Créer Automobile, Formule 1, Saison 2026 avec « Aucune catégorie », une épreuve et une course ; publier.

## E2E-61-02 — Championnat avec catégorie
Créer Moto, MotoGP, catégorie Moto2, Saison 2026, une épreuve et une course ; publier.

## E2E-61-03 — Rejet de catégorie incohérente
Tenter d'associer une catégorie WorldSSP à une saison MotoGP ; attendre HTTP 422 et audit.

## E2E-61-04 — Donnée manuelle puis fournisseur
Créer une épreuve manuellement, synchroniser une correspondance, valider le mapping et vérifier que
l'identifiant canonique reste identique.
