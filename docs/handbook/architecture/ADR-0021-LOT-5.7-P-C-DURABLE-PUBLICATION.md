# ADR-0021 — État de publication durable interne 5.7-P-C

Date : 2026-08-22  
Statut : accepté ; correction additive C/D en attente de revalidation mainteneur

## Décision

Le candidat normalisé fiable est promu vers `public_resource_states` dans la
même transaction que sa révision et `public_change_log`. La séquence est
allouée par PostgreSQL et n’est jamais remise à zéro. Un checksum de la
représentation publique canonique rend les changements internes idempotents.

Un candidat `review_required` ou `blocked` ne crée pas de première publication
et ne remplace jamais le last-known-good. Une annulation est une mise à jour ;
une suppression qualifiée crée un tombstone permanent conservant l’UUID. Le
kill switch arrête uniquement les promotions et conserve l’état fiable.

Les rebuilds rejouent les candidats durables en ordre stable, sans réinitialiser
UUID, tombstones ou séquences. L’état produit par C reste strictement interne.
Aucune route Preview ni sécurité client n’appartient à cette décision.

## Conséquences

- migration additive 0025 avec DOWN peuplé refusé par défaut ;
- verrou transactionnel par ressource, reçus idempotents et fencing réutilisé ;
- 5.7-P-D à F, le Lot 5.7 complet, 5.8+ et merge `main` restent non autorisés.

## Amendement — historique public reconstructible

L'état courant et le journal seuls ne permettent pas de reconstruire un
snapshot lorsqu'une ressource change pendant une pagination. La migration
0027 ajoute donc `public_resource_versions`, historique immuable contenant
uniquement la représentation publique canonique, son checksum, sa révision,
son opération et sa séquence de publication. État courant, version, journal et
reçu sont écrits dans une même transaction.

Une lecture au snapshot N sélectionne, pour chaque ressource, la dernière
version dont `publication_sequence <= N`. Une version `removed` constitue un
tombstone historique explicite: elle masque la ressource dans les nouveaux
snapshots sans la retirer des snapshots antérieurs.

Une base mise à niveau ne peut pas récupérer les versions déjà écrasées avant
0027. La migration crée une baseline de l'état public courant et enregistre
`public_history_controls.oldest_snapshot_sequence`. Tout ancien cursor de page
antérieur à cette frontière expire explicitement. Aucune purge automatique
n'est introduite: les versions sont conservées sans limite à ce stade. La
frontière `/changes` est enregistrée dans `oldest_change_sequence`: elle vaut la
baseline lors d'une mise à niveau, puis suit la première séquence rejouable si
une rétention est introduite. `issuedAt` n'est plus la source de vérité.

L'index `(resource_type, resource_id, publication_sequence desc)` dessert la
reconstruction par `DISTINCT ON` sans requête N+1. Cette correction additive
de C et son adaptation D requièrent une revalidation mainteneur distincte et
n'autorisent ni E ni une exposition publique.
