# Lot 4.3 — Spécification Sessions

## Objectif

Introduire les sessions rattachées à un événement de sport mécanique sans
régression sur le Lot 4.2. Une session représente une unité temporelle et
métier d'un événement : essais, qualifications, sprint, warm-up, course ou
autre type configuré.

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

## Modèle métier minimal

Chaque session doit disposer au minimum de :

- `id` ;
- `event_id` ;
- `name` ;
- `type` ;
- `starts_at` ;
- `ends_at` facultatif ;
- `status` ;
- `published` ;
- `description` facultative ;
- métadonnées d'origine/fournisseur réservées à l'administration ;
- dates de création et de modification.

Le champ `type` doit être contrôlé par une liste métier extensible, sans
couplage à un championnat précis. La première version doit couvrir au moins :
`practice`, `qualifying`, `sprint`, `warmup`, `race`, `other`.

## API administration

Prévoir des routes administratives protégées pour :

- lister les sessions d'un événement ;
- créer une session ;
- consulter une session ;
- modifier une session ;
- supprimer une session ;
- filtrer et trier ;
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

Dans l'administration Événements :

- afficher les sessions de l'événement sélectionné ;
- proposer création, modification et suppression ;
- conserver les maquettes et composants MEDS existants ;
- éviter une nouvelle navigation globale si une intégration au panneau détail
  ou à une section dédiée de l'événement suffit ;
- afficher clairement nom, type, horaire, statut et publication ;
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
- rollback documenté et testé sur PostgreSQL isolé.

## Tests obligatoires

- tests unitaires des schémas et règles temporelles ;
- CRUD API sur PostgreSQL ;
- 401/403/admin success sur les routes administratives ;
- API publique sans métadonnées fournisseur ;
- migration et rollback ;
- tri et filtres avant pagination ;
- sessions traversant minuit et changement DST ;
- scénarios Chromium sur l'administration des sessions ;
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
