# F5-7C — Certification end-to-end déterministe

Statut : `IMPLEMENTED_PENDING_RUNTIME_CERTIFICATION_AND_MAINTAINER_AUDIT`.

Le harnais `scripts/test-f57c-deterministic-e2e.sh` réutilise d'abord le
harnais F5-6 certifié et sa base jetable pour préserver sa transition requise
0036 → 0037 (import legacy compris). Il crée ensuite une seconde base
PostgreSQL jetable, liée uniquement à `127.0.0.1` sur un port dynamique, et
applique la chaîne jusqu'à `0038_f5_canonical_publication` pour le gate F5-7C.
Aucun endpoint provider, worker ou scheduler n'est lancé.
Une tentative `fetch` dans le processus de certification échoue explicitement.

Le gate F5-7C complète la preuve par l'établissement canonique F5-7B, son kill
switch fail-closed et son replay idempotent, puis lit les ressources au travers
des vraies routes Fastify Preview, du repository PostgreSQL et de la sécurité
client. Il couvre l'identité et les relations ChampionshipSeason/Championship
et VenueLayout/Venue, la timezone inconnue conservée à `null`, l'autorisation,
la pagination et les cursors `/changes`, le rollback transactionnel injecté et
le tombstone idempotent. Les tests F5-6 exécutés sur la même base portent la
preuve des observations immuables, de la normalisation, de la résolution
Meeting/Event, des contributions multi-provider, de l'indépendance à l'ordre,
des overrides et de la matérialisation effective.

Cette étape ne crée aucune migration 0039, ne modifie aucune API de production
et n'autorise ni F5-7D, ni provider réel, ni préproduction, ni Production, ni
déploiement. Un PASS local reste en attente d'un audit mainteneur indépendant.
