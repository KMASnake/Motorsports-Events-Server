# Production Preview — Corrections d’audit Concept ↔ Acceptance

Date : 2026-08-16  
Statut : **CORRECTIONS NORMATIVES — IMPLÉMENTATION NON AUTORISÉE PAR CE DOCUMENT**

## 0. Objet et portée

Ce document corrige les écarts détectés lors de l’audit croisé entre :

- `docs/handoff/PRODUCTION-PREVIEW-CONCEPT.md` ;
- `docs/handoff/PRODUCTION-PREVIEW-ACCEPTANCE.md`.

Il complète ces deux documents sans modifier le gate d’implémentation.

En cas de divergence sur les points explicitement traités ci-dessous, **le présent document prévaut** jusqu’à intégration éditoriale ultérieure dans les documents consolidés.

Il ne peut pas :

- autoriser le Lot 5.7 ou 5.7-P ;
- valider globalement le Lot 5.6 ;
- positionner `maintainer_validated=true` ;
- positionner `merge_authorized=true` ;
- autoriser une fusion dans `main` ;
- ouvrir les Lots 5.8+.

---

# 1. Paramètres initiaux du matching

## 1.1 Correction normative

Les valeurs suivantes définies dans le Concept restent des **paramètres initiaux configurables et versionnés** du moteur de matching, et non des invariants métier immuables :

```text
AUTO_MATCH >= 90
REVIEW >= 75
marge premier/deuxième >= 15
au moins 2 signaux structurels indépendants
```

Les règles déterministes, les incompatibilités fortes et la règle conservatrice « ambiguïté => aucune fusion automatique » restent, elles, des invariants normatifs.

Toute modification des paramètres initiaux après implémentation doit :

1. être versionnée ;
2. être traçable ;
3. être couverte par des tests de non-régression ;
4. ne jamais remapper silencieusement une identité publique existante ;
5. préserver le principe selon lequel une ambiguïté ne peut pas conduire à un auto-match.

## 1.2 Correction des critères PP-039 à PP-042

Les critères PP-039 à PP-042 doivent être interprétés comme suit :

### PP-039 — Seuil auto-match initial configurable

La configuration initiale Preview utilise `AUTO_MATCH >= 90`. Le seuil est configurable et versionné ; la conformité porte sur la valeur initiale attendue et sur la capacité à faire évoluer ce paramètre de manière contrôlée, pas sur l’immuabilité de la valeur 90.

### PP-040 — Seuil review initial configurable

La configuration initiale Preview utilise `REVIEW >= 75`. Le seuil est configurable et versionné. Un candidat ambigu ou insuffisant pour un auto-match sûr reste `review_required`, indépendamment d’un score numérique élevé.

### PP-041 — Marge initiale configurable

La configuration initiale Preview exige une marge premier/deuxième d’au moins 15 points. Cette marge est configurable/versionnée. Avec la configuration initiale, le scénario `94/92` doit produire `review_required`.

### PP-042 — Signaux structurels

La configuration initiale exige au moins deux signaux structurels indépendants pour un auto-match scoré. Aucun score seul ne peut contourner une incompatibilité forte ou une ambiguïté d’identité.

---

# 2. Détermination interne d’une fin théorique

## 2.1 Principe

Lorsque le fournisseur ne fournit pas de `ends_at` fiable, le système peut déterminer une **fin théorique interne** à des fins de suivi opérationnel et de finalisation.

Cette estimation doit privilégier l’historique observable du **même championnat et du même fournisseur**, car les épreuves et sessions comparables ont généralement des durées récurrentes.

Ordre de préférence :

1. même type de session sur d’autres épreuves comparables du même championnat et du même fournisseur ;
2. historique récent du même type de session dans ce championnat/fournisseur ;
3. règle de durée explicitement configurée et versionnée lorsque l’historique est insuffisant.

L’estimation doit rester traçable : méthode, échantillon/règle utilisée, durée retenue et version de logique.

Une estimation incohérente ou insuffisamment étayée ne doit pas être présentée comme une certitude.

## 2.2 Séparation stricte interne/public

La fin théorique interne sert notamment :

- au suivi de finalisation ;
- à la détection d’événements anormalement non terminés ;
- à la planification des contrôles post-événement.

Elle **ne transforme jamais** une estimation en `ends_at` public certain.

Si aucune fin fournisseur fiable/validée n’existe :

```text
public ends_at = null
```

Le critère PP-021 reste donc pleinement applicable.

## 2.3 Critère additionnel PP-181

### PP-181 — Fin théorique interne par analogie contrôlée

Lorsqu’un `ends_at` fiable est absent, une fin théorique interne peut être calculée à partir des durées observées de sessions comparables du même championnat et du même fournisseur, avec fallback vers une règle configurée/versionnée.

**Preuves attendues :**

- test avec plusieurs épreuves comparables ;
- résultat déterministe pour un même dataset/version ;
- provenance de l’estimation consultable ;
- `ends_at` public restant `null` tant que la fin n’est qu’estimée.

---

# 3. Finalisation à J+30

## 3.1 Fenêtre de finalisation

Après la fin théorique d’un Event, le pipeline dispose d’une fenêtre maximale de **30 jours** pour identifier/normaliser son état final lorsque celui-ci n’est pas encore établi de manière fiable.

Cette fenêtre ne signifie pas que le système doit attendre 30 jours lorsqu’une preuve fiable de fin est disponible plus tôt.

Une preuve fiable peut donc faire passer l’Event à :

```text
status = completed
```

avant J+30.

## 3.2 Anomalie obligatoire à J+30

Si, **30 jours après la fin théorique**, l’Event n’est toujours pas identifié de manière fiable comme terminé (`completed`) ou couvert par un autre état final explicite pertinent tel que `cancelled`, une anomalie de finalisation doit être créée/remontée.

Cette anomalie :

- ne doit pas fabriquer automatiquement un statut `completed` ;
- ne doit pas supprimer l’Event ;
- ne doit pas écraser un last-known-good ;
- doit être auditée et rattachée à l’Event ;
- doit permettre une résolution administrative ou une résolution automatique ultérieure lorsqu’une preuve fiable apparaît.

Le contrôle doit être idempotent : plusieurs passages après J+30 ne doivent pas créer une nouvelle anomalie identique à chaque exécution.

## 3.3 États explicitement non concernés

Un Event explicitement `cancelled` n’est pas considéré « en attente de completed ».

Un Event `postponed` doit être réévalué selon sa nouvelle planification ; il ne doit pas être artificiellement marqué `completed` à partir de l’ancienne fin théorique.

## 3.4 Critère additionnel PP-182

### PP-182 — Contrôle de finalisation à J+30

Pour tout Event dont la fin théorique est connue, le système vérifie son état de finalisation au plus tard à J+30.

**Scénario obligatoire :**

1. Event avec fin théorique T ;
2. aucune preuve fiable de `completed` ;
3. T + 29 jours : aucune anomalie J+30 obligatoire ;
4. T + 30 jours : Event toujours non finalisé ;
5. une anomalie de finalisation est présente ;
6. le statut public n’est pas falsifié en `completed` ;
7. un nouveau contrôle ne duplique pas l’anomalie active.

## 3.5 Critère additionnel PP-183

### PP-183 — Résolution de l’anomalie de finalisation

Lorsqu’une preuve fiable ultérieure établit l’état final de l’Event, l’anomalie J+30 peut être résolue avec traçabilité de la cause et de la résolution.

**Scénarios obligatoires :**

- preuve ultérieure `completed` => état final normalisé et anomalie résolue ;
- preuve explicite `cancelled` => pas de forçage vers `completed` ;
- Event replanifié/postponed => recalcul du suivi à partir de la planification pertinente, sans utiliser aveuglément l’ancienne fin théorique.

---

# 4. Mise à jour de la règle de clôture

La règle de clôture de `PRODUCTION-PREVIEW-ACCEPTANCE.md` est corrigée ainsi :

> La Production Preview F1 n’est considérée **candidat validable par le mainteneur** que lorsque les critères applicables **PP-001 à PP-183** sont couverts ou explicitement déclarés non applicables avec justification approuvée.

Les critères PP-181 à PP-183 font donc partie intégrante de l’Acceptance Production Preview.

---

# 5. Résultat de correction

Les écarts identifiés par l’audit sont corrigés normativement :

- distinction entre invariants de matching et paramètres initiaux configurables : **CORRIGÉE** ;
- estimation interne de `ends_at` par analogie championnat/fournisseur : **FORMALISÉE** ;
- interdiction d’exposer cette estimation comme fin publique certaine : **CONFIRMÉE** ;
- fenêtre de finalisation de 30 jours : **FORMALISÉE** ;
- anomalie obligatoire si l’Event reste non finalisé à J+30 : **FORMALISÉE** ;
- idempotence et résolution de cette anomalie : **FORMALISÉES** ;
- gate 5.7-P : **INCHANGÉ / NON AUTORISÉ**.

Un second audit croisé doit vérifier la cohérence du triptyque :

```text
PRODUCTION-PREVIEW-CONCEPT.md
PRODUCTION-PREVIEW-ACCEPTANCE.md
PRODUCTION-PREVIEW-AUDIT-CORRECTIONS.md
```

avant de considérer la spécification Production Preview comme figée.