# Production Preview — Corrections d’audit Concept ↔ Acceptance

Date : 2026-08-16  
Statut : **CORRECTIONS NORMATIVES — IMPLÉMENTATION NON AUTORISÉE PAR CE DOCUMENT**

## 0. Objet et portée

Ce document corrige les écarts détectés lors des audits croisés entre :

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

Les valeurs suivantes restent des **paramètres initiaux configurables et versionnés** du moteur de matching, et non des invariants métier immuables :

```text
AUTO_MATCH >= 90
REVIEW >= 75
marge premier/deuxième >= 15
au moins 2 signaux structurels indépendants
```

Les règles déterministes, les incompatibilités fortes et la règle conservatrice « ambiguïté => aucune fusion automatique » restent des invariants normatifs.

Toute modification des paramètres initiaux après implémentation doit :

1. être versionnée ;
2. être traçable ;
3. être couverte par des tests de non-régression ;
4. ne jamais remapper silencieusement une identité publique existante ;
5. préserver le principe selon lequel une ambiguïté ne peut pas conduire à un auto-match.

## 1.2 Interprétation corrigée de PP-039 à PP-042

### PP-039 — Seuil auto-match initial configurable

La configuration initiale Preview utilise `AUTO_MATCH >= 90`. Le seuil est configurable et versionné ; la conformité porte sur la valeur initiale attendue et sur sa capacité d’évolution contrôlée, pas sur l’immuabilité de la valeur 90.

### PP-040 — Seuil review initial configurable

La configuration initiale Preview utilise `REVIEW >= 75`. Le seuil est configurable et versionné. Un candidat ambigu ou insuffisant pour un auto-match sûr reste `review_required`, indépendamment d’un score numérique élevé.

### PP-041 — Marge initiale configurable

La configuration initiale Preview exige une marge premier/deuxième d’au moins 15 points. Cette marge est configurable/versionnée. Avec la configuration initiale, `94/92` doit produire `review_required`.

### PP-042 — Signaux structurels

La configuration initiale exige au moins deux signaux structurels indépendants pour un auto-match scoré. Aucun score seul ne peut contourner une incompatibilité forte ou une ambiguïté d’identité.

---

# 2. Fin théorique interne — alignement strict avec 5.6-D

## 2.1 Hiérarchie normative unique

La Production Preview **ne définit pas une seconde hiérarchie `end_at`**.

Elle réutilise strictement la hiérarchie déjà validée dans le Lot 5.6-D :

1. `end_at` fournisseur fiable ;
2. dernière session source connue lorsqu’elle permet de déterminer la fin pertinente de l’épreuve ;
3. médiane des durées d’au moins **3 événements comparables**, du même fournisseur, même championnat et même type, en privilégiant les données récentes ;
4. règle fiable explicite de l’adaptateur, configurée/versionnée ;
5. fallback sur la date civile pertinente lorsque les niveaux précédents ne permettent pas une estimation suffisamment fondée.

Les niveaux doivent être évalués dans cet ordre. Un niveau inférieur ne doit pas remplacer silencieusement une information plus forte disponible à un niveau supérieur.

## 2.2 Traçabilité de l’estimation

Toute fin théorique estimée doit être traçable :

- méthode retenue ;
- provenance ;
- échantillon ou règle utilisé ;
- durée calculée ;
- version de logique ;
- indicateur `estimated=true` ou équivalent interne.

Lorsqu’on atteint l’étape des événements comparables, les observations récentes doivent être privilégiées conformément à la règle 5.6-D déjà validée.

## 2.3 Séparation stricte interne/public

La fin théorique interne sert notamment :

- au suivi de finalisation ;
- à la détection d’événements anormalement non terminés ;
- à la planification des contrôles post-événement.

Elle **ne transforme jamais** une estimation en `ends_at` public certain.

Si aucune fin fournisseur fiable/validée n’existe :

```text
public ends_at = null
```

Le critère PP-021 reste pleinement applicable.

## 2.4 PP-181 — Fin théorique interne conforme à la hiérarchie 5.6-D

Lorsqu’un `ends_at` fiable est absent, la fin théorique interne est déterminée selon la hiérarchie normative unique 5.6-D ci-dessus.

**Preuves attendues :**

- `end_at` fournisseur prioritaire lorsqu’il existe ;
- dernière session source prioritaire sur l’analogie statistique lorsqu’elle est exploitable ;
- médiane sur au moins 3 événements comparables même fournisseur/championnat/type ;
- préférence donnée aux observations récentes ;
- fallback adaptateur puis civil uniquement lorsque les niveaux supérieurs ne suffisent pas ;
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

Le contrôle est idempotent : plusieurs passages après J+30 ne créent pas une nouvelle anomalie identique à chaque exécution.

## 3.3 États explicitement non concernés

Un Event explicitement `cancelled` n’est pas considéré « en attente de completed ».

Un Event `postponed` doit être réévalué selon sa nouvelle planification ; il ne doit pas être artificiellement marqué `completed` à partir de l’ancienne fin théorique.

## 3.4 PP-182 — Contrôle de finalisation à J+30

Pour tout Event dont la fin théorique est connue, le système vérifie son état de finalisation au plus tard à J+30.

**Scénario obligatoire :**

1. Event avec fin théorique T ;
2. aucune preuve fiable de `completed` ;
3. T + 29 jours : aucune anomalie J+30 obligatoire ;
4. T + 30 jours : Event toujours non finalisé ;
5. une anomalie de finalisation est présente ;
6. le statut public n’est pas falsifié en `completed` ;
7. un nouveau contrôle ne duplique pas l’anomalie active.

## 3.5 PP-183 — Résolution de l’anomalie de finalisation

Lorsqu’une preuve fiable ultérieure établit l’état final de l’Event, l’anomalie J+30 peut être résolue avec traçabilité de la cause et de la résolution.

**Scénarios obligatoires :**

- preuve ultérieure `completed` => état final normalisé et anomalie résolue ;
- preuve explicite `cancelled` => pas de forçage vers `completed` ;
- Event replanifié/postponed => recalcul du suivi à partir de la planification pertinente, sans utiliser aveuglément l’ancienne fin théorique.

---

# 4. Clôture Acceptance — PP-001 à PP-183

La phrase historique de `PRODUCTION-PREVIEW-ACCEPTANCE.md` indiquant une clôture sur **PP-001 à PP-180 est obsolète**.

La règle normative effective est désormais :

> La Production Preview F1 n’est considérée **candidat validable par le mainteneur** que lorsque les critères applicables **PP-001 à PP-183** sont couverts ou explicitement déclarés non applicables avec justification approuvée.

Les critères PP-181, PP-182 et PP-183 font partie intégrante de l’Acceptance Production Preview et doivent être traités exactement comme les critères PP-001 à PP-180.

Toute lecture automatisée ou humaine de l’Acceptance doit considérer :

```text
PRODUCTION-PREVIEW-ACCEPTANCE.md
+
PRODUCTION-PREVIEW-AUDIT-CORRECTIONS.md
=
Acceptance normative effective PP-001 à PP-183
```

Jusqu’à fusion éditoriale dans un fichier unique, cette règle est explicite et ne peut pas être interprétée comme une simple note informative.

---

# 5. Résultat final des corrections

Les écarts des audits croisés sont fermés normativement :

- distinction entre invariants de matching et paramètres initiaux configurables : **CORRIGÉE** ;
- hiérarchie `end_at` alignée strictement sur 5.6-D : **CORRIGÉE** ;
- préférence de récence dans les comparables : **CONFIRMÉE** ;
- interdiction d’exposer une estimation comme fin publique certaine : **CONFIRMÉE** ;
- fenêtre de finalisation de 30 jours : **FORMALISÉE** ;
- anomalie obligatoire si l’Event reste non finalisé à J+30 : **FORMALISÉE** ;
- idempotence et résolution de cette anomalie : **FORMALISÉES** ;
- clôture Acceptance PP-001 à PP-183 : **CORRIGÉE NORMATIVEMENT** ;
- gate 5.7-P : **INCHANGÉ / NON AUTORISÉ**.

Aucun élément de ce document ne constitue une autorisation d’implémentation.