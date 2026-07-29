# ADR 0010 — Logs applicatifs structurés en JSON

## Statut

Accepté le 29 juillet 2026.

## Décision

L’API et le scheduler écrivent une ligne JSON par événement sur la sortie
standard. Chaque entrée contient au minimum l’horodatage UTC, le niveau, le
logger, le service, le type d’événement et le message.

Les accès HTTP sont produits par un middleware avec identifiant de requête,
méthode, chemin sans query string, statut et durée. Le log d’accès texte
d’Uvicorn est désactivé.

Les champs sensibles sont masqués récursivement. Les clés configurées sont
également remplacées lorsqu’une bibliothèque les inclut dans un message.

## Conséquences

Docker peut collecter les logs sans volume applicatif. Les entrées sont
directement exploitables par Loki, Elasticsearch ou un autre collecteur JSON.
La rotation reste sous la responsabilité du runtime Docker et constitue le
sous-jalon suivant.
