# Lot 4.2 — Corrections des événements fournisseur

## 1. Règle métier

Lorsqu'un événement provenant d'un fournisseur est modifié manuellement depuis
l'administration, la modification ne doit pas écraser silencieusement la donnée
fournisseur.

Elle doit créer ou mettre à jour une **correction locale** visible dans la page
`Corrections`.

## 2. Événements concernés

La règle s'applique lorsque l'événement possède au moins une information
d'origine fournisseur, par exemple :

- `origin = provider` ou `origin = mixed` ;
- `provider_key` renseigné ;
- `external_id` renseigné ;
- liaison active vers un enregistrement importé.

Un événement entièrement manuel continue d'être modifié directement sans créer
de correction fournisseur.

## 3. Modèle attendu

Créer ou utiliser une structure de correction contenant au minimum :

```text
id
entity_type            = event
entity_id
provider_key
external_id
field_name
provider_value
override_value
status
created_at
updated_at
created_by
last_provider_seen_at
conflict_detected_at
```

Un modèle JSON par champ ou une structure regroupée par événement est acceptable,
mais la page Corrections doit pouvoir afficher le détail champ par champ.

## 4. Champs corrigeables

Au minimum :

- nom ;
- slug si autorisé ;
- championnat ;
- circuit ;
- catégorie ;
- date de début ;
- date de fin ;
- fuseau horaire ;
- statut ;
- publication ;
- description ;
- pays, ville ou libellé dérivé lorsqu'ils sont administrables.

Les métadonnées internes du fournisseur ne doivent pas être modifiables comme
de simples champs métier.

## 5. Comportement lors d'une modification

### Événement manuel

```text
édition
→ mise à jour directe de l'événement
→ aucune correction fournisseur
```

### Événement fournisseur

```text
édition
→ comparaison avec la valeur fournisseur
→ création/mise à jour d'une correction locale
→ valeur effective calculée = correction locale
→ apparition immédiate dans la page Corrections
```

### Retour à la valeur fournisseur

Si l'administrateur remet exactement la valeur fournisseur :

```text
correction locale supprimée ou marquée résolue
→ valeur effective = valeur fournisseur
→ correction masquée des corrections actives
```

## 6. Synchronisation ultérieure

Une synchronisation ne doit jamais écraser une correction locale active.

Pour chaque champ :

```text
valeur fournisseur mise à jour
+
correction locale éventuelle
=
valeur effective affichée
```

Règles :

- mettre à jour la dernière valeur fournisseur connue ;
- conserver l'override local ;
- détecter un conflit si la valeur fournisseur change sous une correction ;
- afficher ce conflit dans la page Corrections ;
- permettre à l'administrateur de conserver l'override ou d'accepter la
  nouvelle valeur fournisseur.

## 7. Page Corrections

La page doit afficher :

- événement ;
- championnat ;
- fournisseur ;
- champ corrigé ;
- valeur fournisseur actuelle ;
- valeur locale ;
- date de la correction ;
- auteur ;
- statut ;
- présence d'un conflit ;
- date de dernière synchronisation.

Actions :

- modifier la correction ;
- supprimer l'override ;
- accepter la valeur fournisseur ;
- conserver la valeur locale ;
- afficher l'événement concerné ;
- filtrer par fournisseur, championnat, champ, statut et conflit.

## 8. Statuts recommandés

```text
active
conflict
resolved
ignored
```

Une correction active sans conflit est appliquée normalement.

Une correction en conflit reste appliquée tant qu'un administrateur ne décide
pas autrement, sauf règle métier explicitement documentée.

## 9. API d'administration

Prévoir ou conserver des routes cohérentes, par exemple :

```http
GET    /api/v1/admin/corrections
GET    /api/v1/admin/corrections/:id
PATCH  /api/v1/admin/corrections/:id
DELETE /api/v1/admin/corrections/:id
POST   /api/v1/admin/corrections/:id/accept-provider
POST   /api/v1/admin/corrections/:id/keep-override
```

Les noms exacts peuvent suivre les conventions existantes du dépôt.

## 10. API publique

L'API publique doit exposer uniquement la **valeur effective**.

Elle ne doit pas exposer :

- provider_value ;
- override_value ;
- détails de conflit ;
- auteur de la correction ;
- métadonnées internes.

## 11. Calendrier

Dans le calendrier :

- afficher la valeur effective ;
- signaler discrètement qu'un événement possède une correction locale ;
- afficher le détail dans le panneau latéral ;
- ne pas surcharger les petites cartes.

Un badge ou pictogramme `corrigé` peut être utilisé.

## 12. Tests obligatoires

### Création de correction

1. importer ou créer un événement fournisseur ;
2. modifier son nom ;
3. vérifier la création de la correction ;
4. vérifier l'affichage dans la page Corrections ;
5. vérifier la valeur effective dans le calendrier et l'API publique.

### Synchronisation

1. garder une correction locale active ;
2. simuler une nouvelle valeur fournisseur ;
3. vérifier que l'override n'est pas écrasé ;
4. vérifier le conflit ;
5. choisir `conserver la valeur locale` ;
6. vérifier la résolution.

### Suppression d'override

1. remettre la valeur fournisseur ;
2. vérifier la résolution ou suppression de la correction ;
3. vérifier que la page Corrections actives ne l'affiche plus.

### Événement manuel

1. modifier un événement manuel ;
2. vérifier qu'aucune correction fournisseur n'est créée.

## 13. Critères d'acceptation

- [ ] modification d'un événement fournisseur crée une correction ;
- [ ] correction visible immédiatement dans la page Corrections ;
- [ ] valeur fournisseur conservée ;
- [ ] valeur locale conservée ;
- [ ] API publique expose la valeur effective ;
- [ ] synchronisation n'écrase pas l'override ;
- [ ] changement fournisseur sous override crée un conflit ;
- [ ] administrateur peut accepter fournisseur ou garder local ;
- [ ] retour à la valeur fournisseur résout la correction ;
- [ ] événement manuel ne crée pas de correction ;
- [ ] badge corrigé visible dans le détail du calendrier ;
- [ ] tests automatisés présents.


## 14. Mise en évidence obligatoire dans la page Corrections

La page Corrections ne doit pas se limiter à indiquer qu'un événement est
« corrigé ». Elle doit montrer précisément les éléments concernés.

Pour chaque correction, afficher au minimum :

```text
champ concerné
valeur fournisseur
valeur locale effective
type de différence
date de modification
auteur
statut
conflit éventuel
```

### Présentation visuelle

Les éléments corrigés doivent être clairement distingués :

- surlignage du champ modifié ;
- badge `Corrigé` ;
- badge `Conflit` si la source fournisseur a évolué ;
- ancienne valeur fournisseur dans un style secondaire ;
- valeur locale mise en avant ;
- icône ou couleur MEDS dédiée ;
- regroupement par événement ;
- compteur du nombre de champs corrigés.

Exemple :

```text
Grand Prix de France                     3 corrections

Date de début
Fournisseur : 12/05/2026 14:00
Valeur locale : 13/05/2026 14:00        [Corrigé]

Circuit
Fournisseur : Circuit A
Valeur locale : Circuit B               [Conflit]

Statut
Fournisseur : À venir
Valeur locale : Reporté                 [Corrigé]
```

### Filtres supplémentaires

La page Corrections doit permettre de filtrer :

- événement ;
- championnat ;
- fournisseur ;
- champ corrigé ;
- nombre de champs corrigés ;
- statut ;
- conflit ;
- auteur ;
- date de modification.

### Vue détail

L'ouverture d'une correction doit afficher un comparatif champ par champ,
sans masquer les champs non modifiés si ceux-ci sont utiles au contexte.

## 15. Distinction stricte entre données manuelles et données fournisseur

La création manuelle fait de Motorsports Events Server la source de vérité.

Règle absolue :

```text
événement manuel
→ édition directe
→ aucun override fournisseur
→ aucune entrée dans Corrections
```

Une modification d'un événement manuel ne doit jamais être considérée comme
une correction, même si l'événement possède ensuite des champs ressemblant à
ceux d'un fournisseur.

Une correction n'existe que si une valeur source fournisseur réelle et
identifiable est présente pour le champ concerné.

### Cas de conversion future

Si un événement manuel est ultérieurement lié à un fournisseur :

- les données manuelles existantes restent la source locale ;
- l'association doit être explicite ;
- un mapping doit définir quelles valeurs deviennent fournisseur ;
- aucune correction ne doit être créée rétroactivement automatiquement ;
- l'administrateur doit valider le rapprochement.

## 16. Critères d'acceptation complémentaires

- [ ] chaque champ corrigé est identifiable visuellement ;
- [ ] valeur fournisseur et valeur locale sont affichées côte à côte ;
- [ ] nombre de champs corrigés visible par événement ;
- [ ] conflit fortement mis en évidence ;
- [ ] événement manuel absent de la page Corrections ;
- [ ] modification manuelle simple ne crée aucun override ;
- [ ] aucune correction rétroactive lors d'un futur rattachement fournisseur ;
- [ ] tests automatisés couvrent la distinction manual/provider.
