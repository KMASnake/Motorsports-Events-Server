# Lot 4.2 — Calendrier interactif

## Contexte

La base requise est `v8.1.0-alpha.2-lot.4-rev.1`, déjà validée dans GitHub.
Le lot 4.2 enrichit cette base sans supprimer la vue calendrier, la vue liste,
le CRUD, le panneau de détail ni les API existantes.

## Objectif

Transformer le calendrier en outil de planification :

- vues Mois, Semaine, Jour et Agenda ;
- glisser-déposer d’un événement ;
- redimensionnement pour modifier sa durée ;
- création rapide depuis une case ou une plage ;
- duplication ;
- mutations optimistes avec rollback ;
- avertissement simple de conflit ;
- conservation de la fidélité MEDS >= 95 %.

## Règles fonctionnelles

- Mois reste la vue par défaut.
- Les filtres sont communs à toutes les vues.
- La sélection reste synchronisée avec le panneau de détail.
- Le déplacement conserve la durée.
- Le redimensionnement modifie uniquement la fin.
- Une erreur API restaure immédiatement l’état précédent.
- La création rapide ouvre toujours le formulaire existant.
- La duplication crée un nouvel identifiant et un nouveau slug.
- La catégorie reste facultative.
- Aucun provider ne doit apparaître dans l’API publique.
- Aucune optimisation smartphone n’est requise.

## Architecture recommandée

Conserver l’organisation `features/events` de la rev.1 et ajouter si nécessaire :

```text
EventCalendarToolbar.tsx
EventCalendarMonthView.tsx
EventCalendarWeekView.tsx
EventCalendarDayView.tsx
EventAgendaView.tsx
EventQuickCreate.tsx
EventDuplicateDialog.tsx
useEventCalendarState.ts
useEventMutation.ts
eventDnD.ts
eventDateUtils.ts
```

Une seule source d’état doit piloter événements, filtres, vue, date courante,
sélection, mutations optimistes et erreurs.

## Interactions

### Glisser-déposer

1. mise à jour optimiste ;
2. `PATCH /api/v1/admin/events/:id` ;
3. confirmation visuelle ;
4. rollback en cas d’échec ;
5. aucun rechargement global.

### Redimensionnement

- fin >= début ;
- fuseau conservé ;
- rollback sur erreur ;
- durée visible dans le panneau de détail.

### Création rapide

- clic sur une case : préremplir le jour ;
- sélection d’une plage : préremplir début et fin ;
- ouvrir le formulaire existant ;
- aucune création silencieuse.

### Duplication

- nouveau POST ;
- nouvel identifiant ;
- nouveau slug ;
- pas de publication automatique sans confirmation ;
- pas de métadonnées provider copiées inutilement.

## Conflits

Signaler sans bloquer lorsqu’au même circuit deux événements publiés se chevauchent.
La résolution avancée reste prévue pour le lot 4.4.

## Accessibilité desktop

- focus visible ;
- navigation clavier ;
- libellés accessibles ;
- alternative formulaire à toute action drag-and-drop.

## Non-régression

Interdiction de :

- retirer calendrier ou liste ;
- casser les API ;
- casser Championnats ;
- imposer une catégorie ;
- créer une catégorie implicitement ;
- perdre le panneau de détail ;
- remplacer la maquette par un thème générique.

## Tests attendus

### Unitaires

- calcul de durée ;
- déplacement ;
- redimensionnement ;
- conversion de dates ;
- duplication ;
- détection simple des conflits.

### Intégration

- déplacement succès et rollback ;
- redimensionnement succès et rollback ;
- création rapide ;
- duplication ;
- changement de vue ;
- filtres partagés.

### Captures

```text
events-month-1440x900.png
events-week-1440x900.png
events-day-1440x900.png
events-agenda-1440x900.png
events-drag-preview-1440x900.png
events-conflict-warning-1440x900.png
```

## Critères d’acceptation

- [ ] Mois par défaut
- [ ] Semaine
- [ ] Jour
- [ ] Agenda
- [ ] Drag-and-drop
- [ ] Redimensionnement
- [ ] Création rapide
- [ ] Duplication
- [ ] Rollback
- [ ] Filtres partagés
- [ ] Panneau synchronisé
- [ ] Avertissement de conflit
- [ ] Alternative clavier/formulaire
- [ ] API publique non régressée
- [ ] Championnats non régressé
- [ ] Build web/API
- [ ] Docker healthy
- [ ] Tests automatiques
- [ ] Captures
- [ ] Fidélité >= 95 %
