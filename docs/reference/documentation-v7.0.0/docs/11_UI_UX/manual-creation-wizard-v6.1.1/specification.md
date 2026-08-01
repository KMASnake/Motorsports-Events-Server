# Spécification — Assistant de création manuelle v6.1.1

## 1. Objet

L’assistant crée une branche canonique complète sans fournisseur obligatoire : discipline, championnat, catégorie facultative, saison, épreuve, circuit/lieu et sessions. La publication est atomique : aucune publication partielle n’est autorisée.

## 2. Layout commun

- Canevas de référence : 1536 × 1024 px.
- Sidebar : 215 px.
- Topbar : 71 px.
- Contenu : x=244 px, largeur maximale 1269 px.
- Carte principale : x=244 px, y=236 px, largeur=1269 px, hauteur minimale=665 px.
- Étapes : y=194 px, réparties sur toute la largeur utile.
- Bouton secondaire « Précédent » : bas gauche de la carte.
- Bouton principal « Continuer » ou « Publier » : bas droit.
- L’étape courante est rouge, les étapes terminées vertes et les étapes futures grisées.

## 3. Persistance et navigation

- Les données sont conservées lors des allers-retours.
- Un brouillon local est enregistré après toute modification valide.
- Quitter l’assistant avec des changements déclenche une confirmation.
- Le bouton Continuer est désactivé tant que l’étape n’est pas valide.
- La touche Entrée ne publie jamais directement l’étape 7.

## 4. Étape 1 — Discipline

### But
Sélectionner une discipline existante ou en créer une.

### Champs
- Mode : existante / nouvelle.
- Discipline existante : combobox recherchable, obligatoire en mode existant.
- Nom : 2–120 caractères, obligatoire en mode création.
- Slug : proposé automatiquement, modifiable, unique.
- Code court : 2–16 caractères, optionnel.
- Statut : active/inactive, actif par défaut.

### Validation
- Le slug doit être unique.
- Les espaces de début/fin sont supprimés.
- Les doublons proches affichent un avertissement non bloquant.

## 5. Étape 2 — Championnat

### But
Sélectionner un championnat de la discipline ou en créer un.

### Champs
- Discipline sélectionnée, en lecture seule.
- Mode : existant / nouveau.
- Championnat existant : filtré par discipline.
- Nom, slug, code court, statut et ordre d’affichage en création.

### Validation
- Un championnat appartient à une seule discipline.
- Le couple discipline + slug est unique.

## 6. Étape 3 — Catégorie facultative

### Modes
- Aucune catégorie, sélection par défaut.
- Catégorie existante du championnat.
- Nouvelle catégorie.

### Champs de création
- Nom, slug, code court, ordre d’affichage et statut.

### Règle
La saison est directement rattachée au championnat lorsque « Aucune catégorie » est choisie.

## 7. Étape 4 — Saison

### Champs
- Libellé : prérempli avec l’année courante.
- Année de début : obligatoire.
- Année de fin : facultative, >= année de début.
- Date de début et date de fin : facultatives, cohérentes.
- Fuseau horaire par défaut : IANA, `Europe/Paris` par défaut.
- Statut : brouillon, planifiée, active, terminée, annulée.

### Contraintes
- La saison est unique dans la branche championnat/catégorie.
- Une saison sans catégorie conserve explicitement `category_id = null`.

## 8. Étape 5 — Épreuve et circuit

### Épreuve
- Nom, nom court, numéro de manche, statut.
- Date/heure de début et de fin.
- Fuseau horaire IANA.
- Pays, ville et description administrative optionnelle.

### Circuit/lieu
- Mode : circuit existant / nouveau lieu.
- Recherche d’un circuit existant.
- Pour un nouveau circuit : nom, slug, ville, pays, latitude, longitude, fuseau horaire.

### Contraintes
- Fin > début.
- Le fuseau de l’épreuve hérite du circuit puis de la saison.
- Les dates de l’épreuve doivent rester cohérentes avec la saison ; hors plage, avertissement nécessitant confirmation.

## 9. Étape 6 — Sessions

### Tableau éditable
Colonnes : ordre, type, nom public, début, fin, statut, obligatoire, actions.

### Fonctions
- Ajouter, dupliquer, supprimer et réordonner.
- Modèles : week-end course, course unique, essais + qualifications + course.
- Détection des chevauchements.
- Fuseau hérité de l’épreuve, modifiable par session uniquement si autorisé.

### Contraintes
- Au moins une session.
- Chaque session a un début et une fin valides.
- Les sessions obligatoires invalides bloquent la publication.
- Les doublons exacts sont bloqués.

## 10. Étape 7 — Vérification et publication

### Résumé
- Arborescence complète.
- Informations de saison, épreuve, circuit et sessions.
- Avertissements et erreurs regroupés.
- Origine technique `manual` visible uniquement dans l’administration.

### Actions
- Retour vers chaque section par lien « Modifier ».
- « Enregistrer comme brouillon ».
- « Publier » avec modal de confirmation.

### Publication
- Transaction atomique.
- Idempotency key obligatoire côté API.
- En cas d’échec, aucun objet partiel n’est conservé.
- Après succès : toast, lien vers l’événement et entrée d’audit.

## 11. API attendue

Le frontend peut utiliser un endpoint transactionnel :

`POST /api/v1/admin/manual-calendar-branches`

Payload logique :

```json
{
  "discipline": {"mode":"existing","id":"..."},
  "championship": {"mode":"existing","id":"..."},
  "category": null,
  "season": {},
  "event": {},
  "circuit": {"mode":"existing","id":"..."},
  "sessions": [],
  "publicationMode": "publish"
}
```

Le contrat OpenAPI reste la source finale de vérité ; Codex doit créer ou mettre à jour ce contrat avant l’implémentation.

## 12. Tests d’acceptation minimum

1. Parcours sans catégorie.
2. Parcours avec catégorie existante.
3. Création d’une nouvelle discipline, championnat et catégorie.
4. Retour arrière sans perte de données.
5. Validation des dates et des fuseaux.
6. Blocage d’une session obligatoire invalide.
7. Détection d’un chevauchement.
8. Publication atomique réussie.
9. Rollback complet en cas d’erreur API.
10. Navigation clavier et focus visible sur les sept étapes.
11. Aucun nom de fournisseur dans le contenu public.
12. Origine `manual` limitée à l’administration.
