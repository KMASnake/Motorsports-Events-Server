# Webhooks

## Événements
- snapshot.published
- session.updated
- session.cancelled
- synchronization.completed
- synchronization.failed
- conflict.detected
- correction.applied
- override.reverted

## Sécurité
Signature HMAC ou équivalent, protection contre le rejeu, rotation de secret.

## Reprise
Backoff, journalisation de livraison et file de quarantaine.
