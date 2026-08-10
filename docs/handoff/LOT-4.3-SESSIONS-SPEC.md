# Lot 4.3 — Spécification Sessions

## Objectif

Ajouter à l'Événement, qui représente directement une Session métier, un
intitulé spécialisé provenant des fournisseurs ou créé par l'administrateur,
sans régression sur le Lot 4.2.

## Principes

- un événement représente exactement une unité Session métier ;
- il possède zéro ou un intitulé de session ;
- l'interface ne crée ni n'affiche plusieurs sessions sous un événement ;
- les sessions sont stockées en UTC ;
- l'ordre d'affichage est temporel, avec un ordre stable en cas d'égalité ;
- les métadonnées fournisseur restent réservées aux API d'administration ;
- l'API publique n'expose que les champs utiles aux clients ;
- l'origine de l'intitulé reste invisible dans le formulaire ;
- les règles de corrections fournisseur du Lot 4.2 doivent rester compatibles ;
- aucune modification destructive des données existantes n'est autorisée.

## Décision fonctionnelle — intitulé unique de session

Décision mainteneur du 2026-08-10 : l'interface métier ne doit pas demander à
l'utilisateur de gérer séparément un `type` et un `name` de session.

Les API fournisseurs utilisées par le projet exposent un intitulé unique. Le
modèle fonctionnel et l'interface doivent rester alignés sur cette réalité.

L'utilisateur manipule donc un seul champ visible dans le formulaire
Événement : **Intitulé de session**.

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

Chaque Événement conserve son identité, son championnat, son circuit, ses
horaires, son statut, sa publication et sa description. Il reçoit un
`session_title` facultatif. Ce texte n'est pas une clé de référentiel : il peut
provenir d'un fournisseur ou être saisi pour la première fois par
l'administrateur.

Les tables multi-sessions existantes restent transitoirement compatibles mais
ne pilotent plus le formulaire métier.

## API administration

Les routes Événements administratives acceptent et renvoient
`session_title`. La route de suggestions fournit les intitulés provenant de
tous les fournisseurs et des valeurs enregistrées, dédupliqués sans origine
visible. Elle accepte qu'une valeur inédite apparaisse après enregistrement
d'un Événement, sans création préalable d'un type.

Toutes les mutations doivent être auditées et protégées par l'authentification
administrateur existante.

## API publique

L'API publique Événements ajoute uniquement la valeur effective facultative
`session_title`, sans exposer :

- origine ;
- clé fournisseur ;
- identifiant externe ;
- données d'audit ;
- informations administratives internes.

## Interface

Dans l'administration Événements :

- conserver le formulaire Événement et ses champs existants ;
- ajouter un seul champ visible `Intitulé de session` sous forme de combobox
  éditable/créable ;
- alimenter les suggestions avec les valeurs fournisseur découvertes et les
  intitulés déjà enregistrés ;
- permettre immédiatement la saisie d'un intitulé absent de la liste ;
- ne jamais afficher l'origine fournisseur ou locale de la valeur ;
- ne pas afficher de sous-liste ni d'actions CRUD Sessions ;
- conserver les maquettes et composants MEDS existants ;
- éviter une nouvelle navigation globale si l'intégration à la fiche/panneau
  événement suffit ;
- préserver l'usage du calendrier Lot 4.2.

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
- la migration `0004_sessions` déjà validée ne doit pas être réécrite ;
- `0005_event_session_title` ajoute la colonne facultative sans backfill
  ambigu et refuse un rollback destructif.

## Tests obligatoires

- tests unitaires des schémas et règles temporelles ;
- création et modification d'Événement avec `session_title` sur PostgreSQL ;
- 401/403/admin success sur les routes administratives ;
- API publique sans métadonnées fournisseur ;
- migration et rollback ;
- tri et filtres avant pagination ;
- suggestions d'intitulés fournisseur + locaux ;
- création d'un intitulé inédit sans référentiel préalable ;
- absence d'obligation de renseigner séparément type + nom dans le workflow
  métier ;
- Événements traversant minuit et changement DST ;
- scénarios Chromium sur la combobox du formulaire Événement ;
- absence de sous-liste ou de création multiple dans l'interface ;
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
