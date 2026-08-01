# Synchronization

## Rôle
Représente une exécution d'import d'un fournisseur.

## Identité
Identifiant d'exécution unique.

## Attributs essentiels
- Début/fin
- Statut
- Compteurs
- Curseur
- Erreurs

## Relations
- Appartient à un fournisseur
- Produit des observations

## Cycle de vie
Planifiée → En cours → Réussie / Partielle / Échouée / Annulée

## Invariants
- Une exécution terminée est immuable hors annotations

## Événements de domaine
- SynchronizationStarted
- SynchronizationCompleted
- SynchronizationFailed
