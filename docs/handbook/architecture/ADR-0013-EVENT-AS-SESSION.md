# ADR-0013 — L'événement porte l'intitulé de session

Statut : Validé par le mainteneur

Date : 2026-08-11

## Contexte

L'interface expérimentale du Lot 4.3 a matérialisé plusieurs Sessions sous un
Événement. La recette mainteneur a montré que ce niveau de composition ne
correspond pas au modèle métier attendu : dans MEDS, un Événement représente
déjà l'unité planifiée que les fournisseurs nomment séance, course,
qualification ou essai.

Le modèle doit néanmoins conserver un intitulé spécialisé, découvrir les
libellés envoyés par tous les fournisseurs et permettre à l'administrateur
d'en créer un nouveau sans gérer un référentiel séparé.

## Décision

L'Événement est l'unique unité temporelle administrée et correspond à une
Session métier. Il conserve ses champs actuels et reçoit un champ facultatif
`session_title` :

- un Événement possède au plus un intitulé de session ;
- aucune collection de Sessions n'est présentée dans la fiche Événement ;
- le formulaire Événement expose `Intitulé de session` comme une combobox
  éditable et créable ;
- les suggestions réunissent, sans distinction visuelle, les intitulés
  découverts chez tous les fournisseurs et les intitulés déjà enregistrés ;
- une valeur inédite peut être saisie immédiatement et devient ensuite une
  suggestion réutilisable ;
- l'origine fournisseur ou locale n'est jamais affichée à côté de la valeur ;
- les métadonnées fournisseur restent techniques et les règles de valeur
  effective demeurent internes.

`session_title` est un texte métier, et non une clé étrangère vers
`session_types`. Cette absence de contrainte est nécessaire pour accepter une
valeur fournisseur future ou une saisie inédite sans migration préalable.

## Compatibilité transitoire

La migration `0004_sessions`, les tables `sessions`, `session_types` et
`session_corrections`, ainsi que leurs routes, ont déjà été validées. Elles ne
sont ni réécrites ni supprimées dans cette évolution. Elles deviennent un
mécanisme de compatibilité transitoire et ne sont plus le modèle utilisé par
la nouvelle interface Événements.

Le contrat public existant n'est pas amputé. L'ajout facultatif de
`session_title` aux représentations Événement est rétrocompatible. La
suppression future des routes ou tables Sessions exigera une décision et une
version de contrat adaptées.

## Persistance et migration

Une migration `0005_event_session_title` ajoute `events.session_title text
null`. Elle ne transforme pas automatiquement les anciennes lignes
`sessions` : plusieurs lignes peuvent exister pour un Événement et aucune
règle fiable ne permet d'en choisir une sans décision humaine.

Le rollback refuse de supprimer la colonne tant qu'une valeur non nulle
existe. Les données de recette peuvent être explicitement remises à null avant
la descente. Aucune donnée métier n'est supprimée silencieusement.

## Administration et fournisseurs

Les créations et modifications d'Événement acceptent `session_title` comme
champ métier facultatif. Les synchronisations fournisseur pourront alimenter
le même champ via le mécanisme de valeur effective des Événements. L'API de
suggestions agrège au minimum :

1. les valeurs effectives non vides de `events.session_title` ;
2. les valeurs fournisseur connues dans les données de compatibilité ;
3. les valeurs locales déjà enregistrées.

La réponse est dédupliquée sans sensibilité à la casse. Elle n'expose pas
l'origine d'une suggestion.

## Interface

Le champ est placé dans le formulaire de création/modification de
l'Événement, au même niveau que championnat, circuit, dates et statut. La fiche
ne contient plus de sous-liste Sessions, de bouton d'ajout de Session, de badge
« fournisseur/local » ni de dialogue Corrections Sessions séparé.

## Conséquences

- le calendrier continue de manipuler uniquement des Événements ;
- il ne peut pas exister plusieurs Sessions métier sous un Événement dans le
  workflow officiel ;
- les horaires, le statut, la publication et la description restent ceux de
  l'Événement ;
- le travail API Sessions déjà validé est conservé pour compatibilité mais
  n'est plus le chemin principal ;
- les tests UI multi-sessions deviennent obsolètes et doivent être remplacés
  par des tests du champ Événement unique.

## Alternatives rejetées

- conserver plusieurs Sessions sous un Événement : modèle trop complexe pour
  le besoin métier confirmé ;
- liste fermée issue de `session_types` : empêcherait les nouveaux intitulés
  fournisseur et les valeurs inédites ;
- exposer deux champs origine/valeur : détail technique inutile dans le
  formulaire métier ;
- réécrire `0004_sessions` : invaliderait une migration déjà testée et rendrait
  les bases existantes ambiguës.
