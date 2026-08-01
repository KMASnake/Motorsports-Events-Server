# Provider

## Rôle
Représente une source externe configurable.

## Identité
Identifiant interne ; code fournisseur unique.

## Attributs essentiels
- Nom interne
- Type
- URL de base
- Statut
- Limites de débit

## Relations
- Produit des synchronisations et observations

## Cycle de vie
Configuré → Actif → Suspendu → Désactivé

## Invariants
- Les secrets ne sont jamais exposés dans les journaux

## Événements de domaine
- ProviderEnabled
- ProviderDisabled
- ProviderRateLimited
