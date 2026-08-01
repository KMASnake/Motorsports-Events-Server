# Limitation de débit

## Sources
- limites documentées du fournisseur ;
- en-têtes de quota ;
- réponses 429 ;
- politique locale plus prudente.

## Stratégies
- token bucket ou équivalent ;
- quota partagé entre workers ;
- backoff exponentiel avec jitter ;
- respect de `Retry-After` ;
- circuit breaker en cas d'échecs répétés.

## Règle
Le moteur ne doit jamais multiplier les requêtes pour compenser un échec.
