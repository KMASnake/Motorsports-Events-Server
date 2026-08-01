# ADR-001 — Modèle canonique indépendant

## Décision
Le serveur utilise ses propres identifiants et son propre modèle canonique.

## Motif
Les fournisseurs peuvent changer leurs identifiants, schémas ou disponibilités.
Le domaine ne doit pas dépendre d'une source particulière.

## Conséquences
- Table de correspondance nécessaire.
- Conservation des observations brutes.
- Processus explicite de rapprochement et de conflit.
