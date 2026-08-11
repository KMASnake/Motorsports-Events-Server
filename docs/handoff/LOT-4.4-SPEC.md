# Lot 4.4 — Spécification de la duplication d'Événements

Date : 2026-08-11

Branche : `codex/lot-4.4`

Statut : `phase-0-specification-complete-awaiting-maintainer-validation`

## Périmètre strict

Le Lot 4.4 permet à un administrateur de préparer un nouvel Événement à partir
d'un Événement existant. Le modèle reste « un Événement = une Session » et
`session_title` reste son unique intitulé métier de session.

La récurrence, la création en série, les règles de récurrence, la gestion des
conflits et toute détection, alerte ou restriction liée aux chevauchements sont
hors périmètre et ne sont ni spécifiées ni testées dans ce lot.

## Parcours retenu

1. L'administrateur sélectionne un Événement existant.
2. Il choisit **Dupliquer** depuis son détail ou une action équivalente de la
   liste.
3. Le formulaire Événement existant s'ouvre en mode **Nouvel événement à
   partir d'une copie**, sans mutation serveur.
4. Les champs métier copiables sont préremplis selon le tableau ci-dessous.
5. L'administrateur choisit obligatoirement la nouvelle date et peut modifier
   toutes les valeurs métier autorisées.
6. **Créer l'événement** utilise le `POST /api/v1/admin/events` existant.
7. **Annuler** ferme le formulaire sans requête de création et sans audit.

Aucune relation source/copie n'est conservée. Une fois créée, la copie est un
Événement manuel entièrement indépendant.

## Règles exactes par champ

| Champ | Prérempli | Régénéré | Supprimé | Modifiable avant création | Justification |
|---|---:|---:|---:|---:|---|
| Nom | Oui, valeur effective suivie de ` — copie` | Non | Non | Oui | Identifie immédiatement la copie sans écraser le sens métier. |
| Championnat | Oui, valeur effective | Non | Non | Oui | Référentiel métier déjà contrôlé par le formulaire et l'API. |
| Circuit | Oui, valeur effective, y compris absence | Non | Non | Oui | Donnée métier copiable et référencée. |
| Sport | Indirectement via le championnat | Non | Non | Via le championnat | Aucun champ Sport autonome n'existe dans le formulaire Event validé. |
| `session_title` | Oui, valeur effective | Non | Non | Oui, suggestion ou valeur inédite | Préserve le modèle du Lot 4.3 et sa combobox créable. |
| Catégorie | Oui, valeur effective | Non | Non | Oui | Champ métier facultatif existant. |
| Début | Non, champ vide | Non | Oui du brouillon Web | Oui, obligatoire | Évite de créer involontairement la copie au même instant ou selon un décalage arbitraire. |
| Fin | Non, champ vide | Non | Oui du brouillon Web | Oui, facultatif | L'utilisateur fixe explicitement la nouvelle plage ; aucune durée cachée n'est reportée. |
| Fuseau | Non | Oui par le serveur à `UTC` | Oui | Non exposé | Règle UTC permanente ; le Web envoie un ISO avec offset. |
| Statut | Oui, forcé à `draft` dans le brouillon | Non | Non | Oui | Rend explicite qu'il s'agit d'un nouvel objet à vérifier. |
| Publication | Oui, forcée à `false` | Non | Non | Oui | Empêche une publication accidentelle lors de la création. |
| Description | Oui, valeur effective | Non | Non | Oui | Contenu métier utile, sans métadonnée technique. |
| Slug | Non | Oui par le serveur | Oui | Non exposé | Le POST existant appelle `uniqueEventSlug`. |
| ID interne | Non | Oui par le serveur | Oui | Non exposé | Le POST existant utilise un nouvel UUID. |
| `origin` | Non | Oui, valeur `manual` imposée par le serveur | Oui | Non exposé | Toute copie est une création administrative manuelle. |
| `provider_key` | Non | Non | Oui | Non exposé | Aucun rattachement fournisseur ne doit survivre. |
| `external_id` | Non | Non | Oui | Non exposé | Empêche toute collision ou synchronisation de la copie. |
| Corrections | Non | Non | Oui | Non applicable | Seules les valeurs effectives métier préremplissent le formulaire. |
| Overrides | Non | Non | Oui | Non applicable | La copie manuelle ne possède aucune valeur fournisseur à surcharger. |
| Audit source | Non | Non | Oui | Non applicable | L'historique appartient exclusivement à la source. |
| Timestamps techniques | Non | Oui par PostgreSQL | Oui | Non exposés | La copie possède son propre cycle de vie. |

## Date, heure et UTC

La date de début et la date de fin de la source ne sont pas préremplies. Ce
choix est plus sûr qu'une reprise exacte ou qu'un décalage automatique dont la
sémantique serait arbitraire. Le début reste obligatoire avant soumission et
la fin reste facultative.

Le contrôle `datetime-local` affiche l'heure civile compréhensible par
l'utilisateur. Au moment du POST, le Web convertit la valeur en ISO 8601 avec
offset explicite ; le serveur valide l'offset et PostgreSQL conserve l'instant
en UTC. Les tests couvriront minuit et une transition DST sans ajouter de
gestion de fuseau au formulaire.

## Événement fournisseur et valeur effective

Pour une source fournisseur, le formulaire est alimenté uniquement par ses
valeurs effectives visibles : valeur locale d'override si elle existe, sinon
valeur fournisseur. Les identités de source, corrections et overrides ne font
jamais partie de `EventFormState` ni du payload de création.

Le POST existant impose `origin=manual`, `provider_key=null` et
`external_id=null`. Une synchronisation ultérieure de la source ne peut donc
modifier la copie.

## UX et emplacements

- **Détail Événement** : action principale disponible ; c'est l'entrée de
  référence depuis le calendrier.
- **Liste Événements** : ajouter une action Dupliquer à côté de Modifier pour
  éviter l'ouverture préalable du détail.
- **Calendrier** : la sélection ouvre déjà le détail ; aucun nouveau bouton
  dans chaque tuile n'est requis en Phase 1.
- **Formulaire** : réutiliser `EventEditorDialog`, afficher le titre « Nouvel
  événement à partir d'une copie » et un rappel « Aucun événement ne sera créé
  avant Enregistrer ».
- **Annulation** : fermer et abandonner l'état local, sans requête réseau.

Le formulaire ne montre jamais slug, origine, fournisseur, identifiant externe
ou relation avec la source.

## API et audit

### Solution retenue : Web-only + POST existant

Le Web transforme la représentation administrative en `EventFormState`,
applique les règles de préremplissage, puis utilise le POST Event existant.
Cette approche bénéficie déjà :

- de l'authentification globale `admin` et des réponses `401`/`403` ;
- de la validation Zod des champs métier ;
- de la génération serveur de l'UUID, du slug, de l'origine et de l'UTC ;
- du refus des métadonnées techniques ;
- de l'audit de la création réelle via le mécanisme administratif existant ;
- de la projection publique Event inchangée.

Le clic **Dupliquer** ne produit ni requête ni audit. Seule la création réussie
produit une ligne d'audit. Une réponse en erreur ne crée ni Événement ni audit
de succès.

### Option écartée pour ce lot : endpoint dédié

`POST /api/v1/admin/events/:id/duplicate` dupliquerait la lecture, le nettoyage
des métadonnées et la validation déjà assurés par le Web et le POST existant.
Il augmenterait la surface de sécurité, de maintenance et d'audit sans règle
serveur supplémentaire nécessaire. Il ne sera reconsidéré que si un futur
besoin atomique impossible à exprimer par le formulaire est validé dans un lot
distinct.

## Hors périmètre de l'implémentation

- aucune page dédiée ;
- aucune duplication immédiate en base ;
- aucune relation persistante source/copie ;
- aucune nouvelle route ;
- aucune migration ;
- aucune table ou colonne supplémentaire ;
- aucune réintroduction des Sessions multiples ou d'un type de session visible.

## Point d'arrêt

Cette spécification doit être validée explicitement par le mainteneur avant
toute modification applicative.
