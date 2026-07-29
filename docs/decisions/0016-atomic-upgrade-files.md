# ADR 0016 — Rollback atomique des fichiers

## Statut

Accepté.

## Contexte

Une première candidate alpha.12 a échoué après le déplacement du répertoire
persistant `data/`. Le rollback supprimait alors la candidate avant de replacer
ce répertoire dans l’installation précédente. La sauvegarde PostgreSQL a permis
la récupération, mais l’ordre des opérations n’était pas sûr.

## Décision

Les opérations de bascule sont isolées dans `scripts/upgrade-files.sh` et
testées sur une arborescence temporaire contenant une donnée sentinelle.

L’activation :

1. déplace l’installation courante vers le point de rollback ;
2. place la candidate à l’emplacement officiel ;
3. déplace `data/` depuis le rollback vers la candidate.

Le rollback effectue l’ordre inverse et replace `data/` avant de supprimer la
candidate. S’il trouve simultanément deux répertoires de données, il refuse de
continuer afin de ne pas choisir silencieusement lequel conserver.

Lorsque la supervision optionnelle était active, la pile Compose combinée est
arrêtée avant la bascule puis redémarrée après succès ou rollback.

## Conséquences

- un échec de candidate conserve les données bind-mountées ;
- le comportement est vérifiable sans Docker et sans données de production ;
- les volumes nommés Prometheus et Grafana restent conservés ;
- un état ambigu exige une intervention explicite.
