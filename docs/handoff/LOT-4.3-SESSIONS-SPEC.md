# Lot 4.3 — Spécification Sessions

## Objectif

Introduire les sessions rattachées à un événement de sport mécanique sans
régression sur le Lot 4.2. Une session représente une unité temporelle et
métier d'un événement : essais, qualifications, sprint, warm-up, course ou
autre intitulé fourni ou créé localement.

## Principes

- un événement peut contenir zéro, une ou plusieurs sessions ;
- une session appartient à exactement un événement ;
- les sessions sont stockées en UTC ;
- l'ordre d'affichage est temporel, avec un ordre stable en cas d'égalité ;
- les métadonnées fournisseur restent réservées aux API d'administration ;
- l'API publique n'expose que les champs utiles aux clients ;
- les créations manuelles n'imposent aucun fournisseur ;
- les règles de corrections fournisseur du Lot 4.2 doivent rester compatibles ;
- aucune modification destructive des données existantes n'est autorisée.

## Décision fonctionnelle — intitulé unique de session

Décision mainteneur du 2026-08-10 : l'interface métier ne doit pas demander à
l'utilisateur de gérer séparément un `type` et un `name` de session.

Les API fournisseurs utilisées par le projet exposent un intitulé unique. Le
modèle fonctionnel et l'interface doivent rester alignés sur cette réalité.

L'utilisateur manipule donc un seul champ visible : **Intitulé de session**.

Ce champ doit être présenté comme une combobox éditable :

- la liste propose les intitulés déjà découverts dans les données fournisseurs ;
- elle propose également les intitulés déjà créés/utilisés localement ;
- l'utilisateur peut sélectionner une valeur existante ;
- l'utilisateur peut saisir un nouvel intitulé qui n'existe pas encore ;
- un nouvel intitulé local devient ensuite réutilisable dans les suggestions ;
- aucune création préalable dans une page de référentiel n'est exigée ;
- la valeur fournisseur originale doit pouvoir être conservée dans les données
  techniques nécessaires aux corrections/synchronisations sans exposer cette
  complexité dans le formulaire métier.

Exemples d'intitulés : `FP1`, `FP2`, `Q1`, `Q2`, `Qualifications`, `Sprint`,
`Warm-up`, `Race`, `Course 1`, `Superpole`, `Main Event`.

Le référentiel technique `session_types` introduit par la migration `0004` peut
rester présent tant que sa suppression ou son évolution risquerait de casser la
migration déjà validée. Il ne doit cependant pas imposer deux champs à
l'utilisateur. Codex doit adapter les contrats/API de façon rétrocompatible et
consigner toute évolution structurelle nécessaire avant de modifier une
migration déjà validée.

## Modèle métier minimal

Chaque session doit disposer au minimum de :

- `id` ;
- `event_id` ;
- un intitulé métier unique visible par l'utilisateur ;
- `starts_at` ;
- `ends_at` facultatif ;
- `status` ;
- `published` ;
- `description` facultative ;
- métadonnées d'origine/fournisseur réservées à l'administration ;
- dates de création et de modification.

La distinction technique éventuelle entre `name` et `type` ne doit jamais se
traduire par deux champs métier obligatoires dans l'interface. L'API doit
permettre de créer une session à partir de l'intitulé choisi ou saisi par
l'utilisateur.

## API administration

Prévoir des routes administratives protégées pour :

- lister les sessions d'un événement ;
- créer une session ;
- consulter une session ;
- modifier une session ;
- supprimer une session ;
- filtrer et trier ;
- fournir les suggestions d'intitulés provenant des fournisseurs et des valeurs
  locales déjà utilisées ;
- accepter un nouvel intitulé sans création préalable d'un type ;
- ingérer ou synchroniser les données fournisseur sans exposer les champs
  techniques dans les formulaires métier.

Toutes les mutations doivent être auditées et protégées par l'authentification
administrateur existante.

## API publique

L'API publique doit permettre de récupérer les sessions publiées liées aux
événements visibles, sans exposer :

- origine ;
- clé fournisseur ;
- identifiant externe ;
- données d'audit ;
- informations administratives internes.

## Interface

La gestion principale des sessions doit être intégrée à la fiche ou au panneau
de l'événement concerné. Une page Sessions globale ne doit pas devenir le point
d'entrée principal du workflow métier.

Dans l'administration Événements :

- afficher les sessions de l'événement sélectionné ;
- proposer création, modification et suppression ;
- utiliser un seul champ visible `Intitulé de session` sous forme de combobox
  éditable/créable ;
- alimenter les suggestions avec les valeurs fournisseur découvertes et les
  intitulés locaux déjà utilisés ;
- permettre immédiatement la saisie d'un intitulé absent de la liste ;
- conserver les maquettes et composants MEDS existants ;
- éviter une nouvelle navigation globale si l'intégration à la fiche/panneau
  événement suffit ;
- afficher clairement intitulé, horaire, statut et publication ;
- préserver l'usage du calendrier Lot 4.2.

Une éventuelle vue globale Sessions pourra rester un outil administratif
secondaire de recherche/filtrage, mais elle n'est pas le cœur de l'expérience.

## Validation temporelle

- `ends_at` ne peut pas précéder `starts_at` ;
- toutes les entrées datées doivent exiger un offset explicite et être
  normalisées en UTC ;
- couvrir les passages heure d'été/hiver ;
- permettre les sessions traversant minuit ;
- ne pas interdire les chevauchements par défaut : les disciplines peuvent en
  produire volontairement. Un avertissement visuel peut être ajouté sans
  blocage.

## Migrations

- migration versionnée et réversible obligatoire ;
- aucun SQL destructif au démarrage ;
- la base Lot 4.2 doit être migrable sans perte ;
- rollback documenté et testé sur PostgreSQL isolé ;
- la migration `0004_sessions` déjà validée ne doit pas être réécrite sans
  justification, nouvelle recette migration/rollback et validation explicite.

## Tests obligatoires

- tests unitaires des schémas et règles temporelles ;
- CRUD API sur PostgreSQL ;
- 401/403/admin success sur les routes administratives ;
- API publique sans métadonnées fournisseur ;
- migration et rollback ;
- tri et filtres avant pagination ;
- suggestions d'intitulés fournisseur + locaux ;
- création d'un intitulé inédit sans référentiel préalable ;
- absence d'obligation de renseigner séparément type + nom dans le workflow
  métier ;
- sessions traversant minuit et changement DST ;
- scénarios Chromium sur l'administration des sessions depuis un événement ;
- non-régression Lot 4.2.

## Hors périmètre

Le Lot 4.3 n'implémente pas :

- récurrence avancée ;
- duplication en masse ;
- moteur complet de détection/résolution des conflits ;
- refonte globale de l'UX Événements ;
- refonte des circuits.

Ces sujets restent affectés aux lots 4.4, 4.5 et 5.

## Dette technique à reprendre

Deux points issus de l'audit pré-fusion Lot 4.2 doivent être explicitement
évalués pendant le Lot 4.3 :

1. définir le comportement attendu si l'écriture du journal d'audit échoue
   après une mutation métier réussie ;
2. préciser la séparation future entre ingestion fournisseur automatisée et
   actions humaines d'administration.
