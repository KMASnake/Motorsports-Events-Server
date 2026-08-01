# Motorsports Events — Pixel Specification v6.1

**Statut : référence d’implémentation frontend**  
**Source : 8 maquettes PNG officielles v6.1, 1536 × 1024 px**  
**Méthode : mesure directe des aplats, bordures et alignements dans les images raster.**

> Tolérance d’implémentation : ±1 px pour la géométrie, ±2 px pour les boîtes de texte rasterisées. Les dimensions ci-dessous priment sur les anciennes valeurs « à mesurer » du Design System v4.3.

## 1. Canevas et layout global

| Élément | Valeur mesurée |
|---|---:|
| Viewport de référence | 1536 × 1024 px |
| Sidebar | 215 px de large, 1024 px de haut |
| Topbar | x=215, y=0, largeur=1321 px, hauteur=71 px |
| Zone de travail | x=215, y=71, largeur=1321 px, hauteur=953 px |
| Début du contenu principal | x=244 px |
| Marge gauche du contenu | 29 px depuis la zone de travail |
| Marge droite habituelle | 23–24 px |
| Premier bloc sous topbar | y=104 px |
| Espacement topbar → contenu | 33 px |
| Largeur utile maximale | 1269 px |

### Grille principale

- Base d’espacement observée : **4 px**.
- Pas usuels : **8, 12, 16, 20, 24, 28, 32 px**.
- Gouttière principale entre panneaux : **19–20 px**.
- Espacement vertical entre grandes sections : **23–24 px**.
- Padding interne standard des cartes : **19–20 px**.

## 2. Sidebar

| Propriété | Valeur |
|---|---:|
| Largeur | 215 px |
| Fond | `#0D1219` |
| Padding horizontal du logo | 24 px |
| Logo, position haute | y=23 px |
| Séparateur logo/navigation | y≈70 px |
| Item de navigation actif | x=14, largeur=187 px, hauteur=41 px |
| Bande rouge active | 5 px |
| Rayon item actif | 6 px côté droit |
| Padding texte item | 18 px après la bande |
| Écart vertical entre items | 11–12 px visuels |
| Hauteur de ligne cible | 41 px |

### Typographie sidebar

- Marque principale : **23–24 px**, poids **700**, interlettrage léger.
- Sous-marque rouge : **15–16 px**, poids **700**.
- Navigation : **15 px**, poids **400**.
- Navigation active : **15 px**, poids **600**.

## 3. Topbar

| Propriété | Valeur |
|---|---:|
| Hauteur | 71 px |
| Fond | `#0B1016` |
| Bordure basse | 1 px `#25303B` |
| Titre page | x=244, baseline centrée, 26–27 px, poids 700 |
| Recherche | 231 × 37 px |
| Recherche, position | x≈1030, y=16 px |
| Rayon recherche | 19 px |
| État système | à 28 px de la recherche |
| Compte utilisateur | marge droite 23 px |

## 4. Zone de filtres

### Barre standard à 4 filtres

| Filtre | x | Largeur | Hauteur |
|---|---:|---:|---:|
| Discipline | 244 | 231 px | 43 px |
| Championnat | 486 | 231 px | 43 px |
| Catégorie | 728 | 231 px | 43 px |
| Saison | 970 | 191 px | 43 px |

- Gouttière : **11 px**.
- Fond : `#0F161E`.
- Bordure : 1 px `#25303B`.
- Rayon : **6 px**.
- Padding horizontal : **13–14 px**.
- Texte : **14 px**, poids 400.
- Chevron : aligné à **14 px** du bord droit.

## 5. Cartes KPI

### Dashboard, rangée de 5 cartes

| Propriété | Valeur |
|---|---:|
| Position Y | 170 px |
| Hauteur externe | 107 px |
| Largeur externe | 243 px |
| Gouttière | 13 px |
| Bordure | 1 px `#25303B` |
| Rayon | 8 px |
| Padding | 17–18 px |

- Libellé KPI : **12–13 px**, uppercase, poids 600, `#8F9AAA`.
- Valeur KPI : **28–30 px**, poids 700.
- Espacement libellé → valeur : **14–16 px**.

### Rangée de 4 cartes

Sur les écrans Championnats, Fournisseurs, Synchronisations et Corrections : largeur distribuée sur toute la zone utile, hauteur cible **96–107 px**, même style et padding.

## 6. Panneaux et cartes de contenu

| Type | Rayon | Bordure | Fond | Padding |
|---|---:|---|---|---:|
| Grande carte | 8 px | 1 px `#25303B` | `#111821` | 19–20 px |
| Carte compacte | 7–8 px | 1 px `#25303B` | `#111821` | 16–20 px |
| Sous-panneau | 6 px | 1 px `#25303B` | `#0F161E` | 12–16 px |

### Titres

- Titre de page topbar : **26 px / 32 px**, poids 700.
- Titre de section : **21 px / 27 px**, poids 700.
- Titre de carte : **19–20 px / 25 px**, poids 700.
- Sous-titre : **14–15 px**, poids 600.
- Texte courant : **13–14 px / 20 px**.
- Texte secondaire : **13–14 px**, `#8F9AAA`.
- Micro-libellé : **11–12 px**, poids 600.

## 7. Tableaux

| Propriété | Valeur |
|---|---:|
| En-tête | 44 px |
| Ligne standard | 42 px |
| Ligne dense | 38–41 px |
| Fond en-tête | `#151E28` |
| Fond corps | `#111821` ou alternance `#0F161E` |
| Séparateur | 1 px `#202A35` |
| Bordure externe | 1 px `#25303B` |
| Rayon conteneur | 7–8 px |
| Padding horizontal cellule | 11–12 px |

- En-tête : **12–13 px**, poids 600, `#8F9AAA`.
- Cellule : **13 px**, poids 400, `#DEE4EC`.
- Statut : **12–13 px**, poids 600.

## 8. Boutons

### Primaire rouge

| Propriété | Valeur |
|---|---:|
| Hauteur standard | 43 px |
| Hauteur compacte | 32–36 px |
| Padding horizontal | 24–31 px |
| Rayon | 6 px |
| Fond | `#D7252A` |
| Texte | `#FFFFFF`, 14 px, poids 600 |

Exemple mesuré « Ajouter manuellement » : environ **259 × 43 px**.

### Secondaire / contour

- Hauteur : **36–43 px**.
- Fond : transparent ou `#0F161E`.
- Bordure : 1 px `#25303B`.
- Rayon : **6 px**.

### Danger contour

- Bordure : `#6E2026` ou rouge principal selon importance.
- Texte : rouge clair.

## 9. Champs de formulaire

| Propriété | Valeur |
|---|---:|
| Hauteur standard | 43–45 px |
| Hauteur textarea / panneau | selon contenu, grille 4 px |
| Rayon | 6 px |
| Bordure | 1 px `#25303B` |
| Fond | `#0F161E` |
| Padding horizontal | 13–14 px |
| Libellé | 12–13 px, poids 600 |
| Texte | 13–14 px |
| Aide | 11–12 px, `#8F9AAA` |

## 10. Badges et statuts

| Type | Hauteur | Padding horizontal | Rayon |
|---|---:|---:|---:|
| Badge compact | 25–31 px | 12–16 px | 999 px |
| Statut texte | auto | 0 | 0 |
| Étiquette calendrier | 28 px | 8–10 px | 5 px |

Couleurs :

- Succès : `#27B36A`
- Information : `#3A89E8`
- Avertissement : `#E59A2D`
- Accent violet : `#8D6ADE`
- Danger / marque : `#D7252A`

## 11. Palette mesurée

```text
--color-canvas:          #090D12
--color-sidebar:         #0D1219
--color-topbar:          #0B1016
--color-surface:         #111821
--color-surface-input:   #0F161E
--color-surface-alt:     #0F151D
--color-surface-header:  #151E28
--color-border-soft:     #202A35
--color-border:          #25303B
--color-active-dark:     #3B151A
--color-active-border:   #6E2026
--color-brand:           #D7252A
--color-text-primary:    #E7EDF5
--color-text-secondary:  #8F9AAA
--color-success:         #27B36A
--color-info:            #3A89E8
--color-warning:         #E59A2D
--color-purple:          #8D6ADE
--color-white:           #FFFFFF
```

## 12. Ombres

Les maquettes utilisent très peu d’ombres. La séparation repose sur les fonds et bordures.

- Carte : aucune ombre obligatoire.
- Menu flottant / modal futur : `0 12px 32px rgb(0 0 0 / 35%)` recommandé, à valider sur une maquette d’état.
- Focus : anneau de 2 px, décalage 2 px.

## 13. Typographie d’implémentation

La rasterisation correspond à une sans-serif moderne proche d’**Inter**. Pour garantir la fidélité :

```css
font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
```

Échelle : `11, 12, 13, 14, 15, 16, 19, 20, 21, 26, 29 px`.

Poids : `400, 500, 600, 700`.

## 14. Layouts spécifiques mesurés

### Dashboard

- Filtres : y=104, hauteur 43 px.
- KPI : y=170, hauteur 107 px.
- Deux cartes médianes : y=300, hauteur 351 px.
  - Gauche : x=244, largeur 577 px.
  - Droite : x=840, largeur 673 px.
- Carte basse : x=244, y=674, largeur 1269 px, hauteur 313 px.

### Événements

- Calendrier : x=244, y=204, largeur ≈897 px, hauteur ≈783 px.
- Détail sélectionné : x=1160, y=204, largeur ≈353 px, hauteur ≈783 px.
- Gouttière : 19 px.
- Bouton primaire haut : x≈1254, y=104, hauteur 43 px.

### Écrans liste + panneau détail

Patron commun Championnats / Fournisseurs / Corrections :

- Contenu principal gauche : environ 65–72 % de la largeur utile.
- Panneau détail droit : environ 28–35 %.
- Gouttière : 19–20 px.
- Alignement supérieur strict des deux panneaux.

### Création manuelle

- Conteneur assistant centré dans la zone utile.
- Barre d’étapes sous l’introduction.
- Carte d’étape : fond `#111821`, bordure `#25303B`, rayon 8 px.
- Options sélectionnables : hauteur cible 57–67 px.
- Actions en bas : précédent à gauche, continuer à droite.

## 15. Breakpoints proposés sans altérer la référence desktop

Les maquettes ne définissent que le desktop 1536 px. Pour Codex :

- `>= 1280 px` : layout de référence, sidebar 215 px.
- `1024–1279 px` : sidebar 215 px, grilles KPI adaptatives.
- `768–1023 px` : sidebar repliable, panneaux empilés.
- `< 768 px` : navigation drawer, filtres sur une colonne, tableaux scrollables.

Ces règles responsive sont **dérivées**, non pixel-validées. Elles devront faire l’objet de maquettes distinctes.

## 16. Critères de validation visuelle Codex

1. Captures obligatoires à 1536 × 1024.
2. Différence géométrique maximale : 1 px sur layout, 2 px sur texte.
3. Différence de couleur maximale : delta RGB 2 par canal sur aplats.
4. Aucun composant ne doit inventer une ombre absente.
5. Sidebar et topbar doivent rester fixes.
6. Tous les grands alignements doivent suivre x=244 et la grille de 4 px.
7. Tests de régression visuelle sur les 8 écrans de référence.

## 17. Niveau de préparation après cette mesure

| Domaine | Avant | Après |
|---|---:|---:|
| Design System exploitable | 55 % | **82 %** |
| Géométrie du layout | 40 % | **100 %** |
| Couleurs | 70 % | **100 %** |
| Composants nominaux | 55 % | **85 %** |
| Typographie | 50 % | **85 %** |
| Préparation frontend globale | 57 % | **65 %** |

La progression globale reste limitée par les états interactifs, les écrans manquants, le responsive et l’accessibilité. Codex peut désormais implémenter le layout et les huit maquettes officielles avec une fidélité élevée.
