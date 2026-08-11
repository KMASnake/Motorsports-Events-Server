# Lot 4.4 — Analyse d'impact de la duplication d'Événements

Date : 2026-08-11

Statut : `phase-0-specification-complete-awaiting-maintainer-validation`

## Conclusion

La duplication peut être réalisée avec le modèle, le contrat et la base du Lot
4.3. La recommandation est **Web-only** : préparer un `EventFormState` nettoyé
et utiliser le `POST /api/v1/admin/events` existant après confirmation.

- nouvelle route API : **non** ;
- migration PostgreSQL : **non** ;
- nouvelle table ou colonne : **non** ;
- nouvel ADR permanent : **non** ;
- modification du contrat public : **non**.

L'ADR-0001 prévoit déjà qu'une duplication est une nouvelle création métier
avec identité technique générée. Les ADR-0003, 0004, 0007, 0009 et 0013
couvrent respectivement corrections, UTC, calendrier, migrations et modèle
Événement = Session. Aucune décision architecturale permanente nouvelle n'est
requise.

## État actuel constaté

Une fonction `startDuplicate` existe dans `EventsPage.tsx` et l'action est
présente dans `EventDetailsPanel.tsx`. Elle convertit déjà l'Événement avec
`eventToForm`, force le mode création, ajoute ` — copie` au nom et désactive la
publication.

Les écarts à traiter en Phase 1 sont limités :

- vider explicitement début et fin au lieu de reprendre la source ;
- forcer le statut initial `draft` ;
- identifier le mode copie dans le titre et l'aide du formulaire ;
- exposer l'action dans la liste ;
- tester formellement l'absence de métadonnées, corrections et relation source ;
- ajouter le jeu de données et les scénarios de recette dédiés.

## Impact par couche

### Web

Fichiers pressentis, sans modification pendant la Phase 0 :

- `apps/web/src/features/events/EventsPage.tsx` : état du mode copie et règles
  de préremplissage ;
- `apps/web/src/features/events/EventEditorDialog.tsx` : titre et message
  explicites pour un nouvel Événement copié ;
- `apps/web/src/features/events/EventListView.tsx` : action Dupliquer ;
- `apps/web/src/features/events/eventUtils.ts` : fonction pure dédiée produisant
  le brouillon copié ;
- tests unitaires `eventUtils.test.ts` et scénarios Chromium.

`eventApi.saveEvent` reste inchangé : sans `eventId`, il utilise déjà le POST de
création et convertit les dates locales en ISO 8601.

### API

Le `POST /api/v1/admin/events` existant suffit :

- schéma limité aux champs métier ;
- métadonnées techniques explicitement refusées ;
- UUID et slug générés côté serveur ;
- `timezone=UTC`, `origin=manual`, `provider_key=null` et `external_id=null` ;
- transaction unique pour l'insertion ;
- protection administrative globale ;
- audit administratif existant sur le POST réussi.

Aucune route ne doit être créée. Les tests Phase 1 renforceront le contrat
existant pour le cas de duplication, sans ajouter un contrat duplicate.

### Base PostgreSQL et migrations

La table `events` possède tous les champs nécessaires. L'indépendance est
obtenue par une nouvelle ligne Event standard, sans clé vers la source.

Aucune migration n'est nécessaire. Il ne faut créer ni table
`event_duplicates`/`event_copy_relations`, ni colonne `source_event_id`, ni
objet lié à une récurrence ou à un conflit. Les migrations `0004` et `0005`
restent inchangées.

### Fournisseurs et Corrections

L'administration lit la valeur effective de la source, déjà projetée dans
`EventRow`, mais construit seulement un `EventFormState`. Celui-ci ne contient
ni origine, ni `provider_key`, ni `external_id`, ni correction.

La copie manuelle ne doit produire aucune ligne `event_corrections`. Une
synchronisation de la source conserve son propre cycle de vie et n'a aucune
voie technique vers la copie.

### Audit

Le hook d'audit existant cible les mutations `/api/v1/admin/events`. Le simple
préremplissage reste un état Web et ne déclenche rien. Le POST réussi produit
l'audit de création avec le nouvel ID ; l'annulation et les réponses d'erreur
ne produisent pas d'audit de succès.

La Phase 1 doit vérifier ce comportement, notamment l'absence de secrets et
l'unicité de l'entrée de création.

### Calendrier et liste

Le calendrier continue à manipuler uniquement des Événements. Une sélection
donne accès au panneau de détail puis à Dupliquer. La liste recevra une action
directe utilisant le même callback. Après création et rechargement, la copie
apparaît dans les vues normales selon ses date, statut, publication et filtres.

### API publique et clients

Le contrat public ne change pas. La copie n'est visible que si ses règles
ordinaires de statut et publication l'autorisent. Elle expose sa valeur métier
et `session_title`, jamais ses métadonnées internes.

## Comparaison des options

| Critère | Option A — Web + POST existant | Option B — endpoint dédié |
|---|---|---|
| Sécurité | Réutilise la protection admin éprouvée | Nouvelle route et nouveaux tests d'autorisation |
| Complexité | Faible, transformation locale pure | Lecture source, nettoyage et création côté serveur |
| Audit | Un audit au POST réel | Risque d'un chemin d'audit concurrent |
| Maintenance | Un seul contrat de création | Deux chemins de création à maintenir |
| Logique dupliquée | Aucune côté serveur | Validation et nettoyage partiellement redondants |
| Métadonnées fournisseur | Absentes de `EventFormState`, refusées par le POST | Doivent être explicitement filtrées dans une nouvelle route |
| Validation utilisateur | Naturelle avant POST | Nécessite malgré tout un brouillon ou des paramètres |
| Annulation | Aucun effet serveur | Aucun avantage de l'endpoint |

**Décision recommandée : Option A.**

## Risques et mesures

| Risque | Mesure Phase 1 |
|---|---|
| Confondre édition et copie | Mode explicite et titre distinct dans le dialogue. |
| Créer à l'ancienne date | Début et fin vides, début requis. |
| Publier involontairement | `published=false` et `status=draft` par défaut. |
| Copier une identité fournisseur | Construire uniquement `EventFormState` et tester le POST résultant. |
| Copier une valeur brute plutôt qu'effective | Partir de l'`EventRow` administratif déjà effectif. |
| Perdre la combobox Lot 4.3 | Réutiliser sans variante `EventEditorDialog`. |
| Persistance à l'annulation | Interdire tout appel API dans `startDuplicate`. |
| Régression des vues | Rejouer les 11 scénarios Chromium du Lot 4.3. |

## Découpage Phase 1 proposé

1. **Transformation pure et tests unitaires** : produire le brouillon copié et
   prouver le nettoyage champ par champ.
2. **UX formulaire et points d'entrée** : mode copie explicite dans détail et
   liste, sans persistance anticipée.
3. **Contrats API et audit** : tests du POST existant pour copie manuelle,
   sécurité, indépendance, rollback et projection publique.
4. **Données et Chromium** : fixture synthétique, desktop/mobile, annulation,
   erreur et non-régression Lot 4.3.
5. **Recettes finales** : Node 22, Docker, VPS/Windows isolés, commandes de
   jeton et validation mainteneur.

Chaque étape met à jour le suivi et s'arrête pour validation avant la suivante.
