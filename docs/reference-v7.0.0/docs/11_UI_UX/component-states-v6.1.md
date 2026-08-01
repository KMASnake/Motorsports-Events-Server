# Motorsports Events — Spécification des composants et états v6.1

**Statut : référence d’implémentation frontend pour Codex**  
**Dépendances :** `Motorsports-Events-Pixel-Spec-v6.1.md`, `motorsports-events.tokens.css`  
**Tolérance visuelle :** ±1 px sur les boîtes, ±2 px sur le rendu typographique rasterisé.

## 1. Principes obligatoires

1. Aucun composant ne doit inventer une couleur, un rayon, une hauteur ou un espacement hors tokens.
2. Tous les contrôles interactifs doivent exposer au minimum : `default`, `hover`, `focus-visible`, `active`, `disabled` et, si pertinent, `loading`, `error`, `success`.
3. Le focus clavier est toujours visible et ne dépend jamais uniquement de la couleur.
4. Un état métier doit être accompagné d’un libellé lisible ; la couleur seule ne suffit pas.
5. Les transitions d’interface durent de 120 à 180 ms. Elles sont supprimées lorsque `prefers-reduced-motion: reduce` est actif.
6. Les composants bloqués pendant une requête restent dimensionnellement stables afin d’éviter tout déplacement de mise en page.

## 2. Tokens d’état globaux

| Token | Valeur | Usage |
|---|---|---|
| `--mse-focus-ring` | `0 0 0 3px rgba(58,137,232,.34)` | focus clavier |
| `--mse-focus-border` | `#3A89E8` | bordure de focus |
| `--mse-hover-overlay` | `rgba(255,255,255,.045)` | survol neutre |
| `--mse-active-overlay` | `rgba(255,255,255,.075)` | pression active |
| `--mse-disabled-opacity` | `.46` | contrôle désactivé |
| `--mse-error` | `#E04B52` | erreur |
| `--mse-error-soft` | `rgba(224,75,82,.12)` | fond erreur |
| `--mse-success-soft` | `rgba(39,179,106,.12)` | fond succès |
| `--mse-warning-soft` | `rgba(229,154,45,.12)` | fond avertissement |
| `--mse-info-soft` | `rgba(58,137,232,.12)` | fond information |
| `--mse-transition-fast` | `120ms ease-out` | hover/active |
| `--mse-transition-base` | `160ms ease-out` | ouverture/fermeture |

## 3. Layout et navigation

### 3.1 AppShell

- Sidebar fixe : `215px`.
- Topbar fixe ou sticky : `71px`.
- Contenu : marge gauche `29px`, droite `23px`, largeur maximale `1269px`.
- Sous 1180 px : sidebar réduite à `72px`, libellés masqués, infobulle obligatoire.
- Sous 768 px : sidebar devient un drawer modal ; contenu sur une seule colonne.

États à tester :
- chargement initial ;
- navigation active ;
- sidebar réduite ;
- drawer ouvert/fermé ;
- session expirée ;
- erreur globale de chargement.

### 3.2 NavigationItem

| État | Rendu |
|---|---|
| Default | fond transparent, texte secondaire |
| Hover | fond `--mse-hover-overlay`, texte primaire |
| Active | fond `--mse-active-dark`, bande gauche rouge 5 px, texte primaire 600 |
| Focus-visible | anneau info interne, sans déplacement |
| Disabled | opacité `.46`, curseur interdit, non focusable si indisponible |
| Badge | compteur à droite, hauteur 20 px, rayon pill |

### 3.3 TopbarSearch

- Taille desktop : `231 × 37px`.
- `Esc` vide la recherche puis ferme les résultats.
- `Ctrl/Cmd + K` place le focus dans le champ.
- Résultats dans un panneau de 360 à 480 px, maximum 8 résultats visibles.

États : vide, saisie, chargement, résultats, aucun résultat, erreur.

## 4. Boutons

### 4.1 Button

Variantes : `primary`, `secondary`, `ghost`, `danger`, `danger-outline`, `icon`.
Tailles : `compact` 34 px, `standard` 43 px.

| État | Primary | Secondary |
|---|---|---|
| Default | fond brand, texte blanc | fond input, bordure standard |
| Hover | luminosité +7 %, ombre légère | overlay blanc 4,5 % |
| Active | translation Y 1 px, luminosité -5 % | overlay blanc 7,5 % |
| Focus-visible | ring info 3 px | ring info 3 px |
| Disabled | opacité `.46`, aucune ombre | opacité `.46` |
| Loading | spinner 16 px, texte conservé ou aria-label | identique |

Règles :
- aucune double soumission ;
- largeur stable en loading ;
- bouton icône : cible minimale 40 × 40 px ;
- action destructive : confirmation explicite si non réversible.

## 5. Champs et sélections

### 5.1 TextInput / SearchInput / NumberInput

| État | Bordure | Fond | Message |
|---|---|---|---|
| Default | border | input | aide facultative |
| Hover | `#344252` | input | inchangé |
| Focus-visible | info | input | ring 3 px |
| Filled | border | input | valeur primaire |
| Disabled | border-soft | input | opacité `.46` |
| Readonly | border-soft | surface-alt | icône cadenas facultative |
| Error | error | error-soft | texte erreur + icône |
| Success | success | success-soft léger | texte validation facultatif |
| Loading | border | input | spinner à droite |

- Label obligatoire hors placeholder.
- `aria-describedby` relie aide et erreur.
- Hauteur 43–45 px ; textarea minimum 112 px.

### 5.2 Select / Combobox

États supplémentaires : ouvert, option survolée, option sélectionnée, groupe, vide, chargement, erreur distante.

- Panneau : fond surface, bordure standard, rayon 8 px, ombre forte.
- Option : hauteur 38–42 px, padding 12 px.
- Sélection : fond info-soft, coche à droite.
- Navigation clavier : flèches, Home, End, Enter, Escape.
- Les quatre filtres métier conservent l’ordre : Discipline → Championnat → Catégorie → Saison.
- La catégorie affiche explicitement « Sans catégorie » ou « Aucune catégorie » selon le contexte.

### 5.3 Checkbox / Radio / Switch

- Cible interactive minimum 40 × 40 px autour du contrôle.
- Boîte visuelle : 18 × 18 px ; switch : 38 × 22 px.
- États : unchecked, checked, indeterminate, hover, focus, disabled, error.
- Les changements sensibles via switch peuvent exiger confirmation.

### 5.4 DateTimePicker

- Affichage localisé en français.
- Fuseau horaire visible pour les événements.
- Erreurs dédiées : fin antérieure au début, date hors saison, chevauchement de session.

## 6. Cartes, KPI et panneaux

### 6.1 Card

États : default, hoverable, selected, loading, error, disabled.

- Default : fond surface, bordure standard, rayon 8 px.
- Hoverable : bordure `#344252`, translation Y -1 px maximum.
- Selected : bordure info, ring info-soft.
- Error : liseré gauche error 4 px.
- Loading : contenu remplacé par skeleton sans changement de hauteur.

### 6.2 KpiCard

- Hauteur 107 px.
- États métier : neutral, success, warning, danger, info.
- Variation chiffrée accompagnée d’une flèche et d’un texte accessible.
- Valeur inconnue : tiret cadratin `—`, jamais `0` par défaut.

## 7. Tableaux et listes

### 7.1 DataTable

États globaux : loading, populated, empty, filtered-empty, error, stale.

États de ligne : default, hover, selected, expanded, disabled, warning, conflict.

| Élément | Règle |
|---|---|
| En-tête | 44 px, sticky si plus de 8 lignes |
| Ligne | 42 px standard |
| Tri | bouton dans l’en-tête, `aria-sort` |
| Sélection | checkbox + fond info-soft |
| Actions | menu contextuel, jamais uniquement au hover |
| Pagination | taille 36 px, état actif visible |
| Données absentes | `—` + éventuelle infobulle explicative |

- État vide standard : titre, explication, action principale facultative.
- État filtré vide : bouton « Réinitialiser les filtres ».
- Erreur : bouton « Réessayer » et identifiant d’erreur si disponible.
- Stale : bandeau warning « Données potentiellement obsolètes ».

### 7.2 Pagination

États : première page, intermédiaire, dernière page, chargement.
Les boutons indisponibles sont réellement désactivés.

## 8. Badges et statuts métier

### 8.1 Badge

Variantes : neutral, info, success, warning, danger, purple.
États : default, interactive-hover, focus, disabled.

### 8.2 SynchronizationStatus

| Statut | Couleur | Icône | Libellé obligatoire |
|---|---|---|---|
| `queued` | neutral | horloge | En attente |
| `running` | info | spinner | En cours |
| `success` | success | coche | Terminée |
| `partial` | warning | triangle | Partielle |
| `failed` | danger | croix | Échouée |
| `cancelled` | neutral | arrêt | Annulée |
| `paused` | purple | pause | Suspendue |

Une synchronisation en cours affiche progression, durée écoulée et action d’annulation si autorisée.

### 8.3 DataQualityStatus

Statuts : fiable, à contrôler, conflit, correction manuelle, source indisponible.
Chaque statut possède texte, icône, couleur et infobulle descriptive.

## 9. Feedback et retours système

### 9.1 Alert / Banner

Variantes : info, success, warning, error.
- Padding 16 px, rayon 8 px, liseré gauche 4 px.
- Titre 14 px/600, corps 13 px.
- Action secondaire facultative ; fermeture uniquement si le message n’est pas bloquant.

### 9.2 Toast

- Largeur 360–420 px ; position haut-droite sous la topbar.
- Durée : succès 5 s, info 7 s, warning 10 s ; erreur persistante jusqu’à fermeture.
- Pause au hover et au focus.
- Maximum 3 visibles, les suivants sont mis en file.

### 9.3 Modal / ConfirmDialog

Tailles : small 440 px, medium 640 px, large 880 px.
- Focus piégé ; retour au déclencheur à la fermeture.
- `Esc` ferme sauf opération bloquante.
- Destruction irréversible : texte décrivant l’objet et bouton danger.
- Pour suppression critique : saisie du nom ou mot `SUPPRIMER` selon risque.

### 9.4 Drawer

Largeur 420 px standard, 560 px pour édition complexe.
Utilisé pour détails secondaires ou édition sans quitter la liste.

## 10. Chargement, vide et erreurs

### 10.1 Skeleton

- Fond `#19222D`, animation de brillance 1,4 s.
- Respecte exactement les dimensions finales.
- Désactivé sous `prefers-reduced-motion`.
- Après 10 s, afficher un texte « Le chargement prend plus de temps que prévu ».

### 10.2 EmptyState

Variantes : initial-empty, filtered-empty, permission-empty, unavailable.

Contenu : icône, titre, description, une action principale au maximum.

### 10.3 ErrorState

Niveaux : inline, card, page, global.
Inclure : message humain, action de reprise, détails techniques repliables, identifiant de corrélation.

### 10.4 Offline / API unavailable

- Bandeau global persistant.
- Les données en cache sont marquées obsolètes.
- Les actions d’écriture sont désactivées avec explication.

## 11. Actions et permissions

- Toute action non autorisée est masquée si elle n’a aucun intérêt informatif ; sinon affichée désactivée avec motif.
- Les rôles ne doivent jamais être déduits uniquement côté client.
- En cas de `403`, mise à jour immédiate de l’interface et message clair.
- Session expirée : modal non destructrice, sauvegarde locale des formulaires non sensibles, redirection vers connexion.

## 12. Formulaires métier

### Validation

- Validation client à la sortie du champ et à la soumission.
- Première erreur reçoit le focus après soumission.
- Résumé d’erreurs en haut pour les formulaires longs.
- Les erreurs serveur sont mappées sur le champ concerné ; les erreurs globales restent en bannière.

### Assistant de création manuelle

États par étape : non commencée, active, complète, erreur, inaccessible.
- Stepper persistant.
- Sauvegarde brouillon.
- Retour arrière sans perte.
- Étapes : Discipline, Championnat, Catégorie, Saison, Épreuve, Sessions, Vérification et publication.
- La catégorie est facultative et l’option par défaut est « Aucune catégorie ».

## 13. Accessibilité minimale

- Contraste texte normal ≥ 4.5:1 ; grand texte ≥ 3:1.
- Cible interactive ≥ 40 × 40 px, objectif 44 × 44 px.
- Ordre de tabulation identique à l’ordre visuel.
- Aucun piège clavier hors modal/drawer prévu.
- Tous les champs ont un label accessible.
- Les icônes décoratives sont masquées aux technologies d’assistance.
- Les changements asynchrones utilisent une live region adaptée.

## 14. Matrice Storybook obligatoire

Chaque composant doit avoir les stories suivantes :

1. `Default`
2. `Hover` via pseudo-state ou test interaction
3. `FocusVisible`
4. `Active`
5. `Disabled`
6. `Loading` si asynchrone
7. `Error` si saisie ou données
8. `LongContent`
9. `KeyboardNavigation`
10. `ReducedMotion` si animé

Composants prioritaires :
`AppShell`, `Sidebar`, `Topbar`, `Button`, `IconButton`, `TextInput`, `Select`, `Checkbox`, `Switch`, `DateTimePicker`, `Card`, `KpiCard`, `DataTable`, `Badge`, `Alert`, `Toast`, `Modal`, `Drawer`, `Skeleton`, `EmptyState`, `ErrorState`, `Pagination`, `Stepper`, `SynchronizationStatus`.

## 15. Critères d’acceptation Codex

Un composant est terminé lorsque :

- son API TypeScript est typée sans `any` ;
- tous les états applicables ci-dessus existent ;
- le clavier fonctionne sans souris ;
- les attributs ARIA sont corrects ;
- les tokens sont utilisés sans valeur magique ;
- les stories obligatoires existent ;
- les tests d’interaction critiques passent ;
- le diff visuel à 1536 × 1024 reste dans la tolérance ;
- aucune régression n’apparaît à 1280, 1024, 768 et 390 px ;
- `prefers-reduced-motion` est respecté.

## 16. Priorité d’implémentation

### Lot A — socle
AppShell, Sidebar, Topbar, Button, IconButton, Card, Badge, Skeleton.

### Lot B — saisie
TextInput, Select, Checkbox, Switch, DateTimePicker, validation.

### Lot C — données
DataTable, Pagination, EmptyState, ErrorState, KpiCard.

### Lot D — feedback
Alert, Toast, Modal, Drawer, états réseau et permissions.

### Lot E — métier
Stepper, SynchronizationStatus, DataQualityStatus, formulaires de création/correction.
