# Lot 5.6 — Contrat UI ACP acquisition durable

Date : 2026-08-14
Statut : **VALIDÉ EN CONCEPTION — IMPLÉMENTATION NON AUTORISÉE**

Document associé : `docs/handoff/LOT-5.6-ACQUISITION-CONCEPT.md`

## 1. Objet

Ce document formalise le contrat UI validé pour la supervision ACP du Lot 5.6. Il décrit ce que l'administrateur doit voir et pouvoir demander. Il n'autorise aucune implémentation du Lot 5.6.

L'interface étend naturellement la fiche championnat/provider existante. Elle ne crée pas un univers graphique séparé et doit rester cohérente avec l'ACP existant.

## 2. Vue Synchronisation d'un championnat/provider

La fiche doit présenter immédiatement :

- championnat et provider ;
- état global de synchronisation ;
- état `current` ;
- état de finalisation ;
- état de l'historique ;
- dernier run ;
- quota/cadence ;
- anomalies actives ;
- actions administratives autorisées.

États généraux représentables au minimum :

- Actif / Synchronisation OK ;
- En attente quota ;
- En erreur ;
- Suspendu ;
- Bootstrap en cours ;
- Historique terminé.

`Historique terminé` ne signifie jamais que la synchronisation du championnat est arrêtée : `current` et `finalization` continuent normalement.

## 3. Bloc Current

Le bloc Current expose au minimum :

- état actif/inactif ;
- nombre d'événements source futurs connus ;
- date du dernier événement futur actuellement connu ;
- dernier passage réussi ;
- prochaine éligibilité lorsqu'elle est connue ;
- distinction entre fenêtre chaude et futur éloigné.

Règles de représentation :

- `current` couvre J jusqu'à épuisement des événements futurs disponibles chez le fournisseur ;
- J+30 est une **fenêtre chaude par défaut configurable**, pas une limite d'import ;
- l'UI doit pouvoir afficher le nombre d'événements dans J→J+30 et au-delà de J+30 ;
- aucun texte ne doit laisser penser que les événements > J+30 ne sont pas synchronisés.

La fréquence ne doit pas être présentée comme un intervalle métier fixe : elle est déterminée automatiquement par le scheduler et le moteur quota/cadence 5.4/5.5.

## 4. Bloc Finalisation

Le bloc Finalisation expose au minimum :

- nombre d'événements encore dans la période de finalisation ;
- durée de finalisation configurée, 30 jours par défaut ;
- nombre d'anomalies `event_not_finalized_after_grace_period` ;
- accès au détail des événements concernés.

Un événement non identifié comme terminé 30 jours après sa fin théorique produit une anomalie visible. L'UI ne doit pas prétendre que son statut a été forcé à terminé.

Lorsque la fin est estimée, l'interface doit pouvoir indiquer la provenance de l'estimation :

- `provider` ;
- `last_known_session` ;
- `provider_peer_duration` ;
- `adapter_rule` ;
- `civil_day_fallback`.

Une valeur estimée doit être distinguée d'une valeur réellement fournie par le provider.

## 5. Bloc Historique

Le bloc Historique expose :

- état du `recent_catchup` ;
- état du `deep_history` ;
- saison actuellement explorée ;
- dernière saison terminée ;
- nombre de saisons vides consécutives ;
- limite configurée, 5 par défaut ;
- état `Historique terminé` lorsque l'épuisement a été déterminé ;
- checkpoint courant lorsque pertinent.

L'ACP ne doit **pas afficher de faux pourcentage** lorsque la borne historique du fournisseur est inconnue.

Exemple acceptable :

`Exploration : saison 1987 — 2 saisons vides consécutives / 5`

Une fois l'épuisement établi :

`Historique complet`

Les dates et saisons antérieures à 1970 sont supportées. L'UI ne doit appliquer aucune restriction supposant un timestamp Unix positif.

## 6. Checkpoint

Le détail technique peut afficher :

- provider ;
- championnat ;
- flux (`current`, `recent_catchup`, `deep_history`, `finalization`) ;
- saison ;
- page/curseur ou autre mécanisme de reprise ;
- dernière unité confirmée ;
- date de dernière progression.

Aucun secret, credential, header d'authentification ou token fournisseur ne doit être exposé.

Si un curseur est invalidé et que l'acquisition reprend depuis la plus petite unité sûre, l'UI/log peut signaler `checkpoint_invalidated → season_restart` ou équivalent.

## 7. Dernière synchronisation

Le bloc Dernière synchronisation expose au minimum :

- date/heure ;
- durée ;
- nombre d'appels fournisseur ;
- nombre d'éléments créés ;
- modifiés ;
- inchangés ;
- en anomalie ;
- raison d'arrêt éventuelle ;
- état complet/partiel du périmètre.

Une synchronisation partielle ne doit jamais être présentée comme une preuve d'absence fournisseur.

## 8. Quota / cadence

La fiche expose les informations utiles provenant de 5.5, notamment :

- état disponible/bloqué ;
- raison dominante ;
- `next_eligible_at` lorsqu'il existe ;
- indication que la cadence est calculée automatiquement.

Le contrat UI 5.6 ne crée aucun bypass des quotas.

## 9. Détail d'une acquisition / événement source

Un drawer ou panneau de détail doit permettre d'inspecter :

- provider ;
- championnat source ;
- `entity_kind` ;
- identité externe ;
- indication d'identité synthétique éventuelle ;
- épreuve parente/session lorsque cette structure existe chez le fournisseur ;
- dernière observation ;
- dates source ;
- provenance du `end_at` ou de sa valeur estimée ;
- anomalies actives ;
- correction manuelle active oui/non ;
- journal fonctionnel des changements.

L'UI ne doit pas présenter un rapprochement potentiel entre deux IDs fournisseur comme une fusion confirmée. La réconciliation définitive appartient au Lot 5.7.

## 10. Journal fonctionnel

Le détail doit permettre de comprendre les changements significatifs sans dupliquer les payloads fournisseur.

Une entrée peut exposer :

- date ;
- provider ;
- run ;
- type de changement ;
- champ concerné ;
- ancienne valeur ;
- nouvelle valeur ;
- origine (`provider` / `admin`) ;
- présence d'une correction manuelle.

Les changements successifs réels restent distincts.

Les anomalies identiques répétitives sont agrégées avec au minimum :

- `first_seen_at` ;
- `last_seen_at` ;
- `occurrence_count` ;
- état courant.

Après résolution puis réapparition, une nouvelle occurrence logique peut être ouverte.

Aucun payload HTTP complet, secret, credential ou header sensible n'est affiché.

## 11. Vue Anomalies transversale

Une vue ACP transversale doit permettre de filtrer les anomalies au minimum par :

- championnat ;
- provider ;
- type ;
- état.

Elle distingue :

- anomalies événement isolables ;
- anomalies flux/provider bloquantes ;
- événement non finalisé après délai ;
- identité synthétique / rapprochement potentiel lorsque signalé ;
- autres anomalies prévues par le Concept.

Les anomalies répétitives doivent être regroupées plutôt que multipliées en lignes identiques.

## 12. Actions administratives

L'ACP prévoit les actions suivantes :

- Resynchroniser un événement ;
- Resynchroniser une saison ;
- Reprendre l'historique ;
- Reconstruire l'historique depuis une saison choisie.

Ces actions :

- ne suppriment pas automatiquement les données existantes ;
- ne suppriment jamais une correction manuelle ;
- utilisent les upserts source ;
- restent soumises aux leases/fencing 5.4 ;
- restent soumises aux quotas/cadence 5.5 ;
- peuvent donc attendre avant exécution ;
- doivent être journalisées.

Une saison `empty_confirmed` peut être explicitement resynchronisée.

## 13. Confirmation des actions coûteuses

Les actions de resynchronisation/reconstruction susceptibles de provoquer des appels fournisseur doivent afficher une confirmation expliquant :

- que l'opération peut consommer le quota fournisseur ;
- qu'elle ne contourne pas le moteur quota/cadence ;
- qu'elle ne supprime pas les données existantes ;
- qu'elle préserve les corrections manuelles.

La reconstruction historique demande au minimum la saison de départ lorsque cette information est nécessaire.

## 14. Désactivation / réactivation

L'UI doit refléter la règle métier validée :

- désactiver un championnat arrête sa publication et sa synchronisation ;
- les données et checkpoints restent conservés ;
- à la réactivation, `current` reprend ;
- `deep_history` reprend uniquement s'il était incomplet ;
- le passé déjà acquis n'est pas automatiquement resynchronisé ;
- un historique déjà terminé n'est pas rescanné automatiquement.

## 15. Rétention visible

Lorsque la politique de rétention est exposée dans l'ACP :

- logs techniques : 90 jours par défaut, configurable ;
- journal fonctionnel : conservation durable par défaut.

La purge technique ne doit pas être présentée comme une suppression des données source ou du journal fonctionnel.

## 16. États UX obligatoires

Chaque bloc dépendant de données distantes doit prévoir au minimum :

- chargement ;
- état vide ;
- erreur récupérable ;
- erreur bloquante ;
- attente quota ;
- données disponibles.

Les libellés doivent être compréhensibles sans exposer inutilement les détails internes du scheduler.

## 17. Responsive

La fiche doit rester exploitable sur les largeurs déjà supportées par l'ACP. Les blocs Current, Finalisation et Historique peuvent s'empiler sur petit écran sans perdre les états, compteurs ni actions essentielles.

Les tableaux de logs/anomalies doivent disposer d'une représentation adaptée plutôt que provoquer un débordement horizontal inutilisable.

## 18. Sécurité

Le contrat UI respecte les garanties existantes :

- aucune credential provider dans le DOM ou les réponses ACP ;
- aucune fuite de headers sensibles ;
- aucune action destructive implicite ;
- contrôles d'accès ACP existants conservés ;
- confirmations sur actions administratives coûteuses ;
- aucune possibilité UI de contourner quota, lease ou fencing.

## 19. Hors périmètre

Ce contrat n'autorise pas :

- la transformation métier définitive 5.7 ;
- la fusion automatique de deux identités fournisseur ;
- la suppression automatique pour absence fournisseur ;
- l'écrasement des corrections manuelles ;
- un pourcentage historique inventé ;
- des fréquences fixes contournant 5.5 ;
- l'implémentation du Lot 5.6 avant gate mainteneur.

## 20. Maquette textuelle de référence

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Formule 1                                      ● Synchronisation OK │
│ OCBlackTop                                                           │
├──────────────────────────────────────────────────────────────────────┤
│ CURRENT              FINALISATION        HISTORIQUE                 │
│ ● Actif              ● 3 événements      ● En cours                │
│ 24 événements        1 anomalie          Saison : 1987             │
│ Futur jusqu'au       Fenêtre : 30 j      Vides : 2 / 5             │
│ 07/12/2026                                                         │
│                                                                      │
│ Fenêtre chaude : J ━━━━━ J+30 ─────────── dernier futur connu       │
├──────────────────────────────────────────────────────────────────────┤
│ DERNIÈRE SYNCHRONISATION                                             │
│ 14/08/2026 19:17   Durée 1,8 s   2 appels fournisseur              │
│ Créés 2 | Modifiés 1 | Inchangés 21 | Anomalies 0                  │
│ Prochaine exécution : déterminée automatiquement par quotas          │
├──────────────────────────────────────────────────────────────────────┤
│ QUOTA / CADENCE                                                      │
│ État : disponible | Prochaine éligibilité : 19:24                  │
├──────────────────────────────────────────────────────────────────────┤
│ HISTORIQUE                                                           │
│ Saison courante passée : ✓ Terminée                                 │
│ Deep history : ● Exploration | Saison : 1987 | Vides : 2 / 5      │
│ [ Reprendre l'historique ] [ Reconstruire depuis… ]                 │
├──────────────────────────────────────────────────────────────────────┤
│ ANOMALIES                                                     2      │
│ ⚠ Événement non finalisé après 30 jours             [ Détail ]     │
│ ⚠ Date de fin estimée                                [ Détail ]     │
└──────────────────────────────────────────────────────────────────────┘
```

## 21. Gate

Ce contrat UI est **validé en conception**.

Il constitue une entrée de l'Acceptance 5.6 avec `LOT-5.6-ACQUISITION-CONCEPT.md`.

**Lot 5.6 reste NON AUTORISÉ pour l'implémentation.**

Étape suivante : rédaction de l'Acceptance 5.6, puis audit croisé Concept ↔ UI ↔ Acceptance ↔ 5.4 ↔ 5.5 ↔ sécurité avant toute décision mainteneur d'autorisation.
