# Scénarios d'échec

## Cible introuvable
Retourner 404 sans créer de brouillon actif.

## Champ non corrigeable
Retourner 422.

## Override concurrent
Retourner 409 et exposer l'override actif.

## Validation échouée
Conserver le brouillon, sans effet canonique.

## Activation partiellement échouée
Annuler la transaction et ne pas publier.

## Réversion impossible
Conserver l'override actif et ouvrir un conflit.

## Publication échouée
La correction reste active mais la publication est marquée en erreur et rejouée.
