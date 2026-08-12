# Lot 5.1 — Validation des fondations fournisseurs

Date : 2026-08-12

## Périmètre livré

- migrations PostgreSQL `0007` et `0008`, avec scripts `UP` et `DOWN` ;
- instances fournisseurs génériques et schémas structurels secrets/quotas M1 ;
- association fournisseur–championnat et unicité du fournisseur principal actif ;
- configuration source opaque et versionnée, propre à chaque association ;
- reprise des identités historiques en état inactif, sans activation ni appel réseau ;
- contrats TypeScript des adaptateurs, capacités, curseurs, résultats et normalisation ;
- registre minimal d’adaptateurs ;
- faux adaptateurs couvrant les stratégies page, token et curseur composé.

## Résultats locaux

| Contrôle | Résultat |
|---|---|
| Lint des workspaces | OK |
| Typecheck des workspaces | OK |
| Tests Node | 118 réussis : 89 API et 29 web |
| Build API, web et types | OK |
| Tests de contrats fournisseurs | 8 réussis |
| Absence de branche métier WRC dans le noyau générique | OK |

## Recette PostgreSQL isolée

Commande :

```sh
sudo env \
  LOT51_PROJECT=mse-lot51-foundations \
  LOT51_POSTGRES_PORT=55471 \
  ./scripts/test-lot51-foundations.sh
```

La recette contrôle : base neuve, montée M1/M2, seconde montée idempotente,
préservation des données Lot 4.4, reprise historique inactive, deux
configurations distinctes pour une instance, troisième fournisseur, contrainte
concurrente d’unicité du principal actif, descente M2 puis M1 et réapplication.

Cette recette n’a pas été exécutée par Codex le 2026-08-12 : le démon Docker
local n’était pas accessible et les deux demandes d’autorisation ont expiré.
Elle reste obligatoire pour l’audit mainteneur avant toute autorisation du
sous-lot 5.2.

## Garanties de périmètre

- aucun adaptateur fournisseur réel ;
- aucun appel réseau fournisseur ;
- schéma de stockage secret présent, sans chiffrement ni stockage fonctionnel ;
- aucune API d’administration fournisseur ;
- aucun scheduler, worker, quota, cadence, synchronisation ou interface Lot 5 ;
- aucune exception générique dédiée au WRC.

## État

Implémentation du sous-lot 5.1 terminée. Validation mainteneur et recette
PostgreSQL isolée requises. Le sous-lot 5.2 n’est pas commencé.
