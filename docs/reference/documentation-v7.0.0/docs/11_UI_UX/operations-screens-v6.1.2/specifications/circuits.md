# Écran Circuits

## Objectif
Administrer le référentiel canonique des circuits et leurs variantes de tracé.

## Structure
- Titre et action primaire `Ajouter un circuit`.
- KPI : circuits actifs, pays couverts, variantes, fiches incomplètes.
- Filtres : recherche, pays, statut, qualité des données.
- Tableau : nom, ville/pays, variantes, coordonnées, événements à venir, qualité, statut, actions.
- Panneau de détail latéral pour consultation et édition rapide.

## Règles métier
- Le nom canonique et le pays sont obligatoires.
- Latitude et longitude sont validées ensemble.
- Une variante possède son propre nom, longueur et sens de rotation.
- La suppression est interdite lorsqu’un événement dépend du circuit ; proposer l’archivage.
- Les doublons probables sont signalés selon nom normalisé, proximité géographique et aliases.

## États
Chargement, liste vide, filtre sans résultat, coordonnées manquantes, doublon probable, erreur réseau, permission lecture seule.

## Actions
Créer, modifier, archiver, restaurer, fusionner deux doublons, ouvrir les événements associés.
