# Correction

## Rôle
Décision éditoriale traçable appliquée à une donnée canonique.

## Identité
Identifiant interne immuable.

## Attributs essentiels
- Champ
- Ancienne valeur
- Nouvelle valeur
- Motif
- Auteur
- Statut

## Relations
- Cible un objet canonique
- Produit un override

## Cycle de vie
Brouillon → Soumise → Validée → Active → Révoquée / Expirée

## Invariants
- Une correction active est justifiée et auditée

## Événements de domaine
- CorrectionSubmitted
- CorrectionApplied
- CorrectionRevoked
