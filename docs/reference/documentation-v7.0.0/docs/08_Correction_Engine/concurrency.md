# Concurrence

## Contrôle optimiste
Les commandes de modification fournissent la version attendue de la correction.

## Conflit
Si la version a changé :
- retourner 409 ;
- inclure la version actuelle ;
- ne pas écraser la décision concurrente.

## Verrouillage
Un verrou court peut être utilisé pendant l'activation ou la révocation d'un
override, mais ne remplace pas le contrôle de version.
