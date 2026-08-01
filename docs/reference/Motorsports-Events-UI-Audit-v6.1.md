# Audit complet de l'interface d'administration — Motorsports Events Server v6.1

Date de l'audit : 31 juillet 2026

## 1. Références auditées

- `docs/11_UI_UX/README-v6.1.md`
- `docs/11_UI_UX/screen-update-matrix-v6.1.md`
- `docs/11_UI_UX/manual-creation-wizard-v6.1.md`
- `docs/11_UI_UX/design-system-v4.3/*`
- `docs/11_UI_UX/reference-assets/*.png`
- `Motorsports_Events_UI_Storyboard_v6.1.pdf`

Les huit PNG de référence ont tous une définition homogène de 1536 × 1024 pixels.

## 2. Conclusion exécutive

Les huit maquettes présentes sont visuellement cohérentes entre elles et respectent la structure métier v6.1. Aucun redesign majeur n'est nécessaire.

Cependant, l'interface complète n'est pas encore suffisamment spécifiée pour une implémentation frontend autonome par Codex : huit pages ou familles de pages du menu n'ont aucune maquette de référence, le Design System v4.3 ne contient pas encore les mesures pixel-perfect, et les états d'interface essentiels ne sont pas décrits.

- Conformité fonctionnelle des maquettes existantes : **91 %**
- Cohérence visuelle des maquettes existantes : **94 %**
- Couverture des écrans de la console complète : **50 %**
- Complétude du Design System exploitable : **55 %**
- Couverture des états et interactions : **25 %**
- Accessibilité et responsive : **20 %**
- Préparation frontend globale pour Codex : **57 %**

Codex peut commencer le socle technique, le layout global et les composants évidents, mais ne doit pas encore implémenter toute la console sans arbitrages humains.

## 3. Audit des huit maquettes de référence

| Écran | Conformité v6.1 | Couverture visuelle | Statut | Observations |
|---|---:|---:|---|---|
| Dashboard | 100 % | 85 % | Validé sous réserve | Filtres hiérarchiques, KPI, répartition par discipline, santé du catalogue et prochaines épreuves présents. Manquent les états vide/erreur/chargement et le comportement des cartes. |
| Événements | 96 % | 80 % | Validé sous réserve | Filtres Discipline → Championnat → Catégorie → Saison, calendrier et détail sélectionné présents. Le badge « Sans catégorie » est représenté, mais les interactions calendrier/liste et les variantes ne sont pas spécifiées. |
| Détail événement | 96 % | 82 % | Validé sous réserve | Fil d'Ariane complet, relations, sessions et origine administrative présents. Manquent historique, suppression/archivage, confirmations, erreurs et droits. |
| Championnats | 95 % | 82 % | Validé sous réserve | Filtrage par discipline, catégories et saisons directes visibles. Les opérations CRUD, les états sans catégorie et les variantes de saison ne sont pas détaillés. |
| Fournisseurs | 94 % | 78 % | Validé sous réserve | Couverture et mappings par discipline/championnat/catégorie visibles. Manquent les écrans de création/édition du mapping, secrets, tests de connexion et erreurs fournisseur. |
| Synchronisations | 92 % | 75 % | Validé sous réserve | Portée jusqu'à catégorie/saison et historique visibles. Manquent détail d'une exécution, progression, annulation, reprise, conflits et réponses partielles. |
| Corrections | 91 % | 75 % | Validé sous réserve | Types d'entités et validation relationnelle visibles. Manquent création détaillée, édition, comparaison avant/après, réversion, traitement par lots et concurrence. |
| Création manuelle | 66 % | 45 % | Incomplète | La maquette confirme correctement l'étape 3 et « Aucune catégorie » par défaut. Les six autres étapes de l'assistant n'ont pas de maquette détaillée. |

Moyenne pondérée de conformité des maquettes existantes : **91 %**.

## 4. Couverture de la navigation complète

Le menu validé visible dans les maquettes comporte quatorze entrées principales.

| Page principale | Maquette | Spécification exploitable | État |
|---|---|---|---|
| Dashboard | Oui | Oui | Couvert |
| Événements | Oui | Oui | Couvert |
| Championnats | Oui | Oui | Couvert |
| Fournisseurs | Oui | Oui | Couvert |
| Synchronisations | Oui | Oui | Couvert |
| Corrections | Oui | Oui | Couvert |
| Circuits | Non | Partielle dans le domaine/API | À maqueter |
| API | Non | Partielle dans les documents API/sécurité | À maqueter |
| Observabilité | Non | Partielle dans synchronisation/sécurité | À maqueter |
| Journaux | Non | Partielle dans audit/logging | À maqueter |
| Sauvegardes | Non | Partielle dans sécurité/exploitation | À maqueter |
| Utilisateurs | Non | Partielle dans sécurité/permissions | À maqueter |
| Paramètres | Non | Partielle | À maqueter |
| Maintenance | Non | Partielle dans runbooks/exploitation | À maqueter |

Écrans de flux supplémentaires :

- Détail événement : couvert.
- Création manuelle : partiellement couverte, une seule étape sur sept.

Couverture brute : 8 références visuelles pour 16 pages/flux attendus, soit **50 %**.

## 5. Design System v4.3

### Éléments déjà cohérents visuellement

- Layout desktop 1536 × 1024 commun.
- Barre latérale sombre persistante.
- Barre supérieure commune.
- Accent rouge réservé à la sélection et aux actions principales.
- Vert pour les états positifs.
- Cartes et tableaux sur surfaces anthracite.
- Densité d'information homogène.
- Typographie et hiérarchie visuelle cohérentes entre les huit maquettes.

### Éléments non finalisés

Le rapport v4.3 indique explicitement que les mesures pixel-perfect restent à relever. Il manque notamment :

- dimensions exactes de la sidebar et de la topbar ;
- grille, marges, espacements et rayons ;
- tailles et graisses typographiques ;
- palette complète et contrastes ;
- hauteurs des champs, boutons, lignes de tableau et cartes ;
- variantes de composants ;
- focus clavier, hover, active, disabled, danger et loading ;
- règles d'icônes ;
- breakpoints et comportements responsive ;
- spécification des graphiques et calendriers ;
- règles d'animation et de transition.

Complétude estimée du Design System réellement codable : **55 %**.

## 6. États et interactions manquants

Aucune couverture visuelle complète n'a été trouvée pour :

- chargement initial et skeletons ;
- liste vide ;
- recherche sans résultat ;
- erreur serveur et erreur réseau ;
- erreur de validation de formulaire ;
- succès et notifications ;
- confirmations destructives ;
- droits insuffisants ;
- session expirée ;
- pagination et tri ;
- menus contextuels ;
- modales et panneaux latéraux ;
- progression d'une synchronisation ;
- traitement de conflits ;
- édition concurrente ;
- affichage de longs libellés ;
- états partiels ou données inconnues.

Couverture estimée des états/interactions : **25 %**.

## 7. Responsive et accessibilité

Les références sont exclusivement desktop. Aucun comportement tablette/mobile n'est défini. Les contrastes paraissent globalement adaptés à un thème sombre, mais aucune mesure WCAG ni spécification clavier/lecteur d'écran n'est associée aux maquettes.

Complétude estimée : **20 %**.

## 8. Risques pour Codex

1. Codex pourrait inventer l'apparence des huit pages non maquettées.
2. Les mesures non définies produiraient des écarts visuels entre composants.
3. Les formulaires complexes seraient implémentés avec des comportements arbitraires.
4. L'absence d'états de chargement/erreur provoquerait une interface fonctionnelle mais incomplète.
5. Les règles responsive et d'accessibilité seraient traitées tardivement.
6. L'assistant de création manuelle pourrait diverger fortement entre ses sept étapes.

## 9. Ordre recommandé pour atteindre le seuil Codex

| Étape | Livrable | Gain estimé | Préparation Codex cumulée |
|---|---|---:|---:|
| État actuel | Audit et références consolidées | — | **57 %** |
| 1 | Figer le layout et mesurer les tokens pixel-perfect | +8 pts | **65 %** |
| 2 | Définir les composants et leurs états | +8 pts | **73 %** |
| 3 | Maquetter les sept étapes complètes de création manuelle | +5 pts | **78 %** |
| 4 | Maquetter Circuits, API, Observabilité et Journaux | +7 pts | **85 %** |
| 5 | Maquetter Sauvegardes, Utilisateurs, Paramètres et Maintenance | +6 pts | **91 %** |
| 6 | Ajouter états vide/chargement/erreur/confirmation et permissions | +5 pts | **96 %** |
| 7 | Finaliser accessibilité, responsive et tests visuels | +4 pts | **100 %** |

À **73 %**, Codex peut commencer à construire le Design System et les pages déjà validées.
À **85 %**, Codex peut implémenter la majorité de la console avec supervision limitée.
À **96 %**, Codex peut travailler de manière autonome sur le frontend.

## 10. Décision d'audit

- Les huit maquettes de référence v6.1 sont retenues comme base officielle.
- Leur direction graphique est validée et ne doit pas être redessinée.
- La création manuelle doit être complétée avant implémentation intégrale.
- Les huit pages principales sans maquette doivent être conçues dans le même langage visuel.
- Le Design System v4.3 doit être enrichi de mesures et d'états avant d'être présenté comme pixel-perfect.

**Statut final : conception frontend partiellement prête — 57 %.**
