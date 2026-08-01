# Politiques de réversion

## manual_only
Aucune réversion sans action humaine.

## suggest_when_source_matches
Créer une proposition si la source principale correspond à la valeur corrigée.

## suggest_on_consensus
Créer une proposition si plusieurs fournisseurs fiables convergent.

## expire_at_date
Expirer à une date prévue, avec validation préalable possible.

## auto_revert_on_consensus
Réversion automatique uniquement si :
- la correction l'autorise ;
- le seuil de consensus est atteint ;
- aucun conflit bloquant n'existe ;
- l'audit est complet.

La politique par défaut est `manual_only`.
