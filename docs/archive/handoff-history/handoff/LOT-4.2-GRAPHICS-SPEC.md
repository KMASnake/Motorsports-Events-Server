# Lot 4.2 rev.1 — Exigences graphiques officielles

## 1. Statut

Ces exigences complètent et renforcent le lot 4.2. Elles sont obligatoires
avant validation du développement Codex.

Les références officielles sont :

```text
docs/ui-reference/validated-mockups/dashboard-validated.png
docs/ui-reference/validated-mockups/events-validated.png
docs/ui-reference/validated-mockups/motorsports-events-header-logo-reference.png
```

## 2. Logo Motorsports Events

Le bloc d'identité en haut à gauche doit reproduire celui de la maquette :

- symbole compteur/tachymètre ;
- texte `MOTORSPORTS EVENTS` ;
- mention `SERVER` ;
- proportions identiques ;
- alignement identique ;
- taille et espacement identiques ;
- aucune icône générique ;
- aucun remplacement par un simple texte ;
- aucun emoji ;
- aucun logo provisoire.

Le composant doit être centralisé, par exemple :

```text
apps/web/src/design-system/branding/MotorsportsEventsLogo.tsx
```

Il doit être utilisé par la Sidebar et par toute vue nécessitant l'identité
officielle du produit.

### Format de production

Ordre de préférence :

1. SVG local versionné ;
2. PNG local haute résolution avec transparence ;
3. composition CSS/SVG fidèle à la maquette.

Ne pas charger le logo depuis une URL externe à l'exécution.

## 3. Logos officiels des championnats

Le calendrier doit afficher les logos officiels lorsqu'ils sont disponibles.

Exemples concernés :

- Formula 1 ;
- Formula 2 ;
- Formula 3 ;
- Formula E ;
- MotoGP ;
- Moto2 ;
- Moto3 ;
- MotoE ;
- WSBK ;
- WSSP ;
- WRC ;
- WEC ;
- IndyCar ;
- NASCAR.

### Règles

- utiliser une ressource locale ;
- préserver les proportions ;
- ne jamais étirer ;
- utiliser `object-fit: contain` ;
- prévoir un fond neutre ou transparent ;
- prévoir une alternative textuelle ;
- prévoir un fallback MEDS si le logo manque ;
- ne jamais afficher une image cassée.

### Emplacements

Les logos doivent apparaître de façon cohérente dans :

- cartes du calendrier ;
- panneau de détail ;
- vue Agenda ;
- vue Liste ;
- formulaire de sélection ;
- légende du calendrier lorsque pertinente.

Le logo peut être omis dans une carte extrêmement compacte si son affichage
dégraderait la lisibilité, mais il doit alors rester visible dans le panneau
de détail et accessible par infobulle ou libellé.

## 4. Drapeaux des pays

Les événements doivent afficher le drapeau correspondant au pays du circuit.

### Source de vérité

Le pays doit être déterminé depuis le circuit associé, via un code ISO 3166-1
alpha-2 normalisé.

Exemples :

```text
FR
IT
ES
DE
GB
US
JP
AU
```

### Règles

- utiliser des ressources locales ou une bibliothèque légère versionnée ;
- aucune dépendance à un service distant ;
- conserver une taille homogène ;
- fournir le nom du pays comme texte accessible ;
- fallback neutre si le code est absent ou invalide ;
- ne pas utiliser uniquement l'emoji comme rendu officiel.

### Emplacements

- carte calendrier si l'espace le permet ;
- panneau de détail ;
- Agenda ;
- Liste ;
- sélecteur de circuit ;
- légende ou info-bulle.

## 5. Logos des circuits

Lorsque la base contient un logo de circuit valide :

- l'afficher dans le panneau de détail ;
- l'afficher dans la fiche ou la future page Circuits ;
- ne pas rendre son affichage obligatoire dans les petites cartes mensuelles ;
- utiliser un fallback typographique si absent.

## 6. Cartes du calendrier

Chaque carte doit tendre vers cette hiérarchie :

```text
[logo championnat] [nom court]
[drapeau] [pays ou circuit]
[titre / séance]
[heure début – heure fin]
[statut éventuel]
```

Priorité d'affichage sur faible hauteur :

1. titre ;
2. horaire ;
3. championnat ;
4. statut ;
5. drapeau ;
6. logo.

Les cartes ne doivent jamais devenir illisibles pour afficher toutes les
informations simultanément.

## 7. Badges et statuts

Rendus obligatoires :

- À venir ;
- En cours ;
- Terminé ;
- Annulé ;
- Reporté ;
- Brouillon ;
- Publié / non publié.

Les couleurs doivent venir des tokens MEDS et respecter les contrastes.

## 8. Gestion des assets

Créer une structure claire :

```text
apps/web/public/assets/
├── branding/
│   └── motorsports-events/
├── championships/
├── countries/
├── circuits/
└── fallbacks/
```

Créer également un registre TypeScript :

```text
apps/web/src/assets/assetRegistry.ts
```

Il doit fournir :

- résolution par slug de championnat ;
- résolution par code pays ;
- résolution par slug de circuit ;
- fallback ;
- alt text ;
- dimensions recommandées.

## 9. Légalité et provenance

Codex doit :

- utiliser les fichiers déjà autorisés ou fournis dans le dépôt ;
- documenter la provenance de chaque ressource ;
- ne pas télécharger automatiquement un logo depuis un site tiers pendant le build ;
- ne pas intégrer une ressource dont les droits sont incertains sans la signaler ;
- fournir un fallback lorsque la ressource officielle ne peut pas être distribuée.

Créer :

```text
docs/assets/ASSET-SOURCES.md
```

avec pour chaque asset :

- nom ;
- chemin ;
- source ;
- statut de licence/autorisation ;
- date d'ajout ;
- notes.

## 10. Critères de validation graphique

- [ ] logo officiel de la maquette en haut à gauche ;
- [ ] aucune icône provisoire ;
- [ ] logos de championnats visibles ;
- [ ] drapeaux visibles ;
- [ ] fallback sans image cassée ;
- [ ] proportions respectées ;
- [ ] rendu cohérent entre Mois, Semaine, Jour, Agenda et Liste ;
- [ ] captures 1440×900 ;
- [ ] comparaison avec la maquette ;
- [ ] fidélité globale cible >= 98 % ;
- [ ] provenance des assets documentée.
