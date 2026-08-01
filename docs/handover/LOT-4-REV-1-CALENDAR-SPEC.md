# Spécification de développement Codex
## Motorsports Events Server v8.1.0-alpha.2-lot.4-rev.1

## 1. Objet

Restaurer la vue calendrier validée de la page **Événements** sans supprimer
les fonctionnalités CRUD, les filtres ni les API introduites dans le lot 4.

La régression identifiée est la disparition de la vue calendrier au profit
d'une liste d'administration unique.

La maquette officielle est :

```text
docs/ui-reference/validated-mockups/events-validated.png
```

Cette image constitue un contrat de rendu, pas une simple source d'inspiration.

## 2. Décision produit

La page Événements doit proposer deux vues :

- **Calendrier** : vue principale et sélectionnée par défaut ;
- **Liste** : vue secondaire destinée aux opérations de gestion dense.

Aucune évolution future ne doit supprimer l'une de ces deux vues.

## 3. Contraintes fonctionnelles à préserver

Le lot 4 existant doit rester intégralement fonctionnel :

- création d'un événement ;
- modification ;
- suppression ;
- rattachement obligatoire à un championnat ;
- circuit facultatif ;
- catégorie facultative ;
- date de début et date de fin ;
- fuseau horaire ;
- statut ;
- publication/dépublication ;
- recherche ;
- filtres ;
- API publique ;
- API d'administration.

Les règles métier suivantes sont absolues :

- un événement manuel n'a pas besoin de provider ;
- aucune catégorie ne doit être créée implicitement ;
- les métadonnées internes de provider ne doivent pas apparaître dans l'API publique ;
- un événement publié doit être visible par les clients API ;
- un brouillon ou un événement dépublié ne doit pas apparaître dans l'API publique.

## 4. APIs à conserver

### API publique

```http
GET /api/v1/events
GET /api/v1/events/:id
```

Elle retourne uniquement les événements publiés, non brouillons, associés à
un championnat actif.

### API d'administration

```http
GET    /api/v1/admin/events
GET    /api/v1/admin/events/:id
POST   /api/v1/admin/events
PATCH  /api/v1/admin/events/:id
DELETE /api/v1/admin/events/:id
```

La restauration du calendrier ne doit modifier ni les routes ni les contrats
JSON existants, sauf correction documentée d'un défaut réel.

## 5. Architecture frontend cible

Créer une organisation par fonctionnalité :

```text
apps/web/src/features/events/
├── EventsPage.tsx
├── EventsToolbar.tsx
├── EventsFilters.tsx
├── EventsViewSwitcher.tsx
├── EventCalendarView.tsx
├── EventListView.tsx
├── EventDetailsPanel.tsx
├── EventEditorDialog.tsx
├── eventApi.ts
├── eventTypes.ts
├── eventColors.ts
└── eventUtils.ts
```

Le fichier `apps/web/src/pages/EventsPage.tsx` devient un point d'entrée léger
ou est remplacé par un réexport depuis `features/events`.

## 6. Composants requis

### EventsViewSwitcher

Deux boutons ou onglets :

```text
Calendrier | Liste
```

Règles :

- `Calendrier` actif par défaut ;
- état conservé pendant la session ;
- navigation clavier ;
- `aria-pressed` ou rôle d'onglets approprié ;
- aucune dépendance mobile spécifique.

### EventCalendarView

Vue principale conforme à la maquette.

Doit afficher :

- mois courant ;
- navigation mois précédent/suivant ;
- bouton Aujourd'hui ;
- grille lundi à dimanche ;
- événements colorés selon le championnat ;
- nom court du championnat ;
- nom ou type de session/événement ;
- statut visuel si annulé ou reporté ;
- clic sur un événement ;
- clic sur un jour vide pour préparer une création ;
- panneau de détail synchronisé.

La première implémentation peut rester interne et sans FullCalendar si elle
reproduit fidèlement la maquette. Ne pas ajouter une dépendance lourde sans
justification dans la PR.

### EventListView

Doit réutiliser le CRUD actuel.

Doit conserver :

- tableau ;
- recherche ;
- filtres ;
- publication ;
- modification ;
- suppression ;
- actions ;
- état vide ;
- chargement ;
- erreurs.

### EventDetailsPanel

Panneau latéral permanent ou contextuel.

Contenu minimal :

- championnat ;
- titre de l'événement ;
- circuit ;
- ville et pays ;
- début ;
- fin ;
- fuseau ;
- statut ;
- publication ;
- origine administrative ;
- catégorie si présente ;
- boutons Modifier, Dupliquer et Supprimer.

Le nom du provider ne doit pas être présenté dans une description destinée au public.

### EventEditorDialog

Le même formulaire sert à la création et à l'édition.

Champs :

- nom ;
- slug ;
- championnat ;
- circuit facultatif ;
- catégorie facultative ;
- début ;
- fin ;
- fuseau ;
- statut ;
- publié ;
- description administrative facultative.

Validation :

- championnat obligatoire ;
- nom obligatoire ;
- date de fin >= date de début ;
- slug unique si saisi ;
- erreur API affichée dans le formulaire ;
- fermeture seulement après succès ou annulation.

## 7. Couleurs

Utiliser une source unique :

```text
eventColors.ts
```

Priorité :

1. couleur enregistrée sur le championnat ;
2. couleur officielle MEDS par discipline ;
3. couleur neutre de secours.

La même couleur doit être utilisée dans :

- calendrier ;
- liste ;
- panneau de détail ;
- badges ;
- légende.

## 8. États UI obligatoires

Chaque vue doit couvrir :

- chargement ;
- erreur ;
- aucune donnée ;
- aucun résultat filtré ;
- succès de sauvegarde ;
- erreur de sauvegarde ;
- confirmation de suppression ;
- événement sélectionné ;
- aucun événement sélectionné.

## 9. Fidélité à la maquette

Objectif minimal : **95 %**.

Éléments à mesurer :

- largeur de la sidebar ;
- hauteur de la topbar ;
- marges du contenu ;
- hauteur de la barre de filtres ;
- répartition calendrier / panneau latéral ;
- densité de la grille ;
- taille des blocs événements ;
- typographie ;
- couleurs ;
- bordures ;
- espacements.

La page doit être optimisée pour :

- référence : 1440 × 900 ;
- minimum supporté : 1280 × 720 ;
- aucun objectif smartphone.

## 10. Non-régression

Interdictions :

- remplacer le calendrier par la liste ;
- supprimer les filtres ;
- supprimer le panneau de détail ;
- casser l'API publique ;
- exposer `provider_key`, `external_id` ou `origin` dans l'API publique ;
- dupliquer un composant déjà disponible dans MEDS ;
- modifier le schéma PostgreSQL sans migration documentée ;
- créer une catégorie automatiquement.

## 11. Tests automatisés attendus

### API

Conserver et étendre `validate-lot4.mjs` :

1. créer un événement publié ;
2. vérifier sa présence dans l'API publique ;
3. vérifier l'absence des métadonnées internes ;
4. modifier l'événement ;
5. dépublier ;
6. vérifier sa disparition de l'API publique ;
7. republier ;
8. supprimer ;
9. vérifier sa disparition finale.

### Frontend

Ajouter des tests de composant ou Playwright :

- calendrier affiché par défaut ;
- bascule Calendrier/Liste ;
- sélection d'un événement ;
- ouverture du formulaire ;
- création ;
- modification ;
- confirmation de suppression ;
- filtres actifs dans les deux vues ;
- absence de régression visuelle majeure.

### Capture visuelle

Créer au minimum :

```text
tests/ui/screenshots/events-calendar-1440x900.png
tests/ui/screenshots/events-list-1440x900.png
```

La PR doit joindre :

- maquette validée ;
- capture du résultat ;
- liste des écarts résiduels.

## 12. Plan d'implémentation recommandé

### Étape A — Refactor sans changement visuel

- extraire le client API ;
- extraire les types ;
- déplacer le formulaire ;
- conserver la vue liste fonctionnelle.

### Étape B — Restaurer le calendrier

- créer `EventCalendarView` ;
- mapper les événements ;
- navigation mensuelle ;
- sélection ;
- panneau de détail.

### Étape C — Ajouter la bascule

- `Calendrier` par défaut ;
- `Liste` secondaire ;
- état partagé des filtres et de la sélection.

### Étape D — Finaliser la fidélité

- comparaison 1440×900 ;
- corrections de densité ;
- couleurs ;
- typographie ;
- bordures ;
- états vides et erreurs.

### Étape E — Tests et passation

- build web ;
- build API ;
- Docker ;
- validate-lot4 ;
- captures ;
- mise à jour PROGRESS.json ;
- mise à jour UI_CHANGELOG.md.

## 13. Critères d'acceptation

La rev.1 est acceptée uniquement si :

- [ ] les trois conteneurs sont healthy ;
- [ ] le calendrier est visible par défaut ;
- [ ] la liste reste disponible ;
- [ ] la sélection fonctionne dans les deux vues ;
- [ ] le formulaire CRUD fonctionne ;
- [ ] la suppression fonctionne ;
- [ ] les filtres s'appliquent aux deux vues ;
- [ ] l'API publique reste conforme ;
- [ ] la maquette atteint au moins 95 % de fidélité ;
- [ ] aucune régression Championnats ;
- [ ] `PROGRESS.json` est mis à jour ;
- [ ] les captures de comparaison sont jointes à la PR.

## 14. Définition de terminé

Le développement n'est pas terminé lorsque « le calendrier s'affiche ».

Il est terminé lorsque :

- calendrier, liste et panneau de détail fonctionnent ensemble ;
- les actions CRUD utilisent la même source de données ;
- la vue par défaut correspond à la maquette ;
- les tests passent ;
- le build Docker passe ;
- les écarts visuels sont documentés ;
- le dossier de passation est à jour.
