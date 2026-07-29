# ADR 0008 — Isoler les routes d’administration

## Statut

Accepté le 29 juillet 2026.

## Contexte

`app.main` mélangeait le contrat public, l’authentification Web, les API
d’administration et le tableau de bord. Cette concentration augmentait le
risque de modifier involontairement les routes publiques lors des évolutions
de l’administration.

## Décision

- `app.main` reste le point d’entrée de l’API publique ;
- `app.admin.core` porte l’authentification, le tableau de bord, les overrides
  et le déclenchement des synchronisations ;
- `app.admin` agrège le routeur principal et la façade
  `app.admin_extension` existante ;
- les chemins, méthodes HTTP, cookies, redirections et réponses restent
  inchangés ;
- aucune refonte visuelle n’est incluse dans cette séparation.

## Conséquences

Les prochaines fonctions d’administration disposent d’un emplacement dédié.
La façade historique pourra être séparée progressivement sans modifier le
point d’entrée FastAPI ni les contrats déjà validés sur le VPS.
