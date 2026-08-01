# Tests d'acceptation API

- API-001 : `GET /championships` retourne une enveloppe paginée.
- API-002 : `pageSize > 100` retourne 400.
- API-003 : un filtre inconnu retourne 400.
- API-004 : une ressource absente retourne une erreur avec `correlationId`.
- API-005 : une même clé d'idempotence ne crée pas de doublon.
- API-006 : même clé avec contenu différent retourne 409.
- API-007 : une route admin sans authentification retourne 401.
- API-008 : un utilisateur sans permission retourne 403.
- API-009 : les réponses publiques ne citent jamais le fournisseur.
- API-010 : une date sans fuseau explicite est rejetée en écriture.
- API-011 : une qualification sprint n'est jamais `isSprintRace=true`.
- API-012 : aucune stack trace ni secret dans une erreur.
