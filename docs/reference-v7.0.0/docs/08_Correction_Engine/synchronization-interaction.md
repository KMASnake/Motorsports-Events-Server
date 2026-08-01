# Interaction avec la synchronisation

Lors d'une synchronisation :

1. Le moteur calcule la valeur fournisseur candidate.
2. Il vérifie l'existence d'un override actif.
3. Si aucun override n'existe, la fusion suit la politique normale.
4. Si un override existe, la valeur canonique reste corrigée.
5. La nouvelle observation est néanmoins conservée.
6. Le moteur évalue une éventuelle proposition de réversion.
7. Un conflit peut être créé si la divergence devient importante.

## Règle
Les champs non corrigés restent librement synchronisables.
