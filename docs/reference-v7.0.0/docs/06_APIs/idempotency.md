# Idempotence

L'en-tête `Idempotency-Key` est recommandé pour :
- lancer une synchronisation ;
- créer une correction ;
- importer ;
- publier un snapshot.

Même clé + même acteur + même contenu = même résultat logique.
Même clé + contenu différent = erreur 409.
