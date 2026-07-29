# ADR 0017 — Artefacts de release après validation

## Statut

Accepté.

## Décision

Le workflow GitHub Actions contient un job `release-artifact` dépendant des
jobs `validate` et `postgres-integration`. Il exécute le script officiel
`scripts/build-release.sh`, vérifie l’empreinte produite puis publie ensemble
le ZIP et son fichier `.sha256`.

Les artefacts de branches et de pull requests sont conservés quatorze jours.
La création d’une GitHub Release et d’un tag stable reste une opération
distincte, réservée à une version validée sur le VPS.

## Conséquences

- aucune archive GitHub n’est produite si un test échoue ;
- le même script construit les archives locales et CI ;
- chaque artefact contient son empreinte vérifiée ;
- une archive candidate est téléchargeable sans dépendre du workspace Codex ;
- la publication officielle reste contrôlée séparément.
