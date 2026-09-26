# Lot 5.3 — Découverte des championnats et configurations de source

Date : 2026-08-12

Statut : concept validé par le mainteneur

Ce document complète et, pour le périmètre 5.3, précise `LOT-5-PROVIDERS-SYNC-SPEC.md` et `LOT-5-PROVIDERS-SYNC-ACCEPTANCE.md`. En cas de contradiction sur 5.3, ce document prime.

## 1. Périmètre

Le sous-lot 5.3 implémente la découverte réelle des championnats et la configuration de source par championnat avec les vrais adaptateurs OCBlackTop et TheSportsDB.

5.3 ne lance aucune synchronisation d'événements, aucun bootstrap, aucun historique d'événements et aucun scheduler de synchronisation.

Les appels réseau sont limités au test de connexion et aux opérations de découverte strictement nécessaires.

## 2. Adaptateurs réels

- implémenter OCBlackTop et TheSportsDB selon le contrat `ProviderAdapter` déjà validé ;
- WRC reste un championnat OCBlackTop, jamais un fournisseur ou adaptateur autonome ;
- un même fournisseur peut exposer plusieurs championnats via plusieurs endpoints, slugs, IDs ou stratégies ;
- la logique spécifique est portée par l'adaptateur et la `source_config` du lien fournisseur/championnat ;
- le cœur générique ne branche jamais sur le nom WRC ou un autre nom de championnat.

OCBlackTop ne documente pas d’endpoint global `/sports`. Son adaptateur utilise
donc un catalogue déclaratif maintenable des séries prises en charge, avec une
stratégie et un modèle d’endpoint par entrée. La provenance
`adapter-known-catalog` est distincte d’une réponse dynamique fournisseur.
Toutes les séries, y compris WRC, utilisent les mêmes mécanismes déclaratifs.

TheSportsDB utilise `all_leagues.php`, mais le résultat n’est complet que si
la configuration sûre du compte le garantit explicitement. À défaut, le run
est `partial` et ne produit aucun constat d’absence.

## 3. Découverte sans création automatique

Une découverte réelle crée ou met à jour une représentation fournisseur persistante, mais ne crée jamais automatiquement un championnat métier MEDS.

Un résultat nouveau reste dans un état du type :

`À associer / à créer`

jusqu'à validation manuelle.

Si un mapping explicitement validé existe déjà, il peut être réutilisé automatiquement.

## 4. Entité persistante de découverte

Le modèle doit disposer d'une entité distincte des `provider_championships` pour conserver les résultats non encore associés, par exemple `provider_discovered_championships` ou équivalent adapté au schéma existant.

Elle doit pouvoir stocker au minimum :

- instance fournisseur ;
- identifiant externe fournisseur ;
- nom/libellé découvert ;
- métadonnées fournisseur utiles ;
- `source_config` proposée et sa version ;
- première découverte ;
- dernière découverte ;
- nombre d'absences consécutives sur découvertes complètes ;
- état `discovered`, `needs_association`, `associated`, `not_found` ou équivalent ;
- référence vers `provider_championship` après validation si applicable.

Cette entité ne rend jamais un flux de synchronisation éligible.

## 5. Association manuelle

L'administrateur doit pouvoir :

- associer une découverte à un championnat métier existant ;
- ou créer explicitement un nouveau championnat métier à partir des données préremplies ;
- vérifier et confirmer la `source_config` proposée ;
- enregistrer le lien en état `Configuré — non synchronisé`.

Aucune association ambiguë n'est automatique.

La découverte reste uniquement une aide. La configuration manuelle d'une
source de championnat reste disponible lorsque la découverte est absente,
désactivée, partielle ou ne retourne pas le championnat recherché. Elle part
directement du formulaire `championshipForm()` de l'adaptateur, valide
localement la `source_config`, puis crée le lien et sa configuration sans ligne
de découverte artificielle et sans appel réseau.

Deux commandes administratives explicites sont disponibles : lier une source
à un championnat métier existant, ou créer un championnat métier puis son lien
dans la même transaction. Dans les deux cas, le lien est `manual`, `inactive`,
non principal et son résultat est « Configuré — non synchronisé ».

**Manual championship source configuration remains available even when
provider discovery is unavailable, partial or does not contain the requested
championship.**

## 6. Plusieurs fournisseurs pour un championnat

Plusieurs découvertes provenant de fournisseurs différents peuvent être associées au même championnat métier.

V1 conserve la règle : un seul fournisseur principal actif pour la synchronisation d'un championnat.

Les autres liens peuvent rester enregistrés comme sources alternatives inactives sans fusion multisource.

## 7. Redécouverte et divergence

Une redécouverte ne doit jamais écraser automatiquement une `source_config` déjà validée manuellement.

Lorsqu'un identifiant externe configuré manuellement apparaît ensuite dans une
découverte, celle-ci est rattachée au lien existant sans duplication. Une
configuration proposée différente est signalée comme divergence et reste
séparée de la configuration manuelle validée.

Si la configuration proposée par le fournisseur diffère de la configuration active :

- conserver la configuration active ;
- conserver séparément la configuration proposée ;
- afficher une divergence ;
- permettre une action explicite `Adopter la configuration découverte` ;
- auditer l'adoption ;
- ne lancer aucune synchronisation à la suite de l'adoption.

## 8. Découverte manuelle et périodique

La découverte manuelle `Découvrir / Redécouvrir maintenant` est disponible.

La découverte automatique est configurable par fournisseur :

- activée/désactivée ;
- intervalle par défaut : 30 jours ;
- intervalle minimum : 7 jours ;
- `last_discovery_at` conservé ;
- `next_discovery_at` calculé par le système, pas choisi comme date libre par l'administrateur.

5.3 implémente le modèle, la logique d'éligibilité et la découverte manuelle réelle.

L'exécution périodique automatique est branchée sur le scheduler persistant à partir de 5.4 afin d'éviter un second scheduler parallèle.

## 9. Quotas et crédits API

La découverte doit être volontairement économe.

5.3 doit :

- compter les requêtes de découverte ;
- utiliser les limites sûres déjà configurées en 5.2 ;
- refuser ou reporter une découverte lorsque son exécution n'est pas sûre ;
- ne jamais consommer volontairement la réserve de 30 % dédiée à l'année courante ;
- ne jamais contourner les limites via une commande manuelle.

Le moteur complet de quotas, cadence, fenêtres combinées et observations avancées reste en 5.5. 5.3 ne doit pas créer un second moteur de quota concurrent.

## 10. Championnat non retrouvé

Aucune suppression automatique.

Après 3 découvertes complètes consécutives où un championnat fournisseur précédemment connu n'est pas retrouvé, il est marqué `Non retrouvé chez le fournisseur` et une alerte/indication administrative est produite.

Ne comptent pas comme absence :

- découverte échouée ;
- découverte interrompue ;
- découverte reportée pour quota ;
- résultat partiel ;
- erreur réseau ou fournisseur.

Une réapparition remet le compteur à zéro et résout l'état de disparition.

Le contrat de découverte retourne conjointement les éléments, la provenance
et `complete`. Seul `complete=true` autorise l’incrément des absences.

## 11. Historique des découvertes

Les opérations de découverte doivent être traçables indépendamment des futures synchronisations d'événements.

Un historique minimal durable `DISCOVERY` doit enregistrer :

- origine `manual` ou `periodic` ;
- début, fin, durée ;
- statut ;
- nombre de requêtes API consommées ;
- nombre trouvé ;
- nouveaux résultats ;
- résultats non retrouvés ;
- divergences de configuration ;
- erreurs expurgées ;
- motif d'un éventuel report.

Ce modèle doit pouvoir converger ensuite vers la présentation commune des runs/logs de 5.8 sans anticiper toute l'infrastructure 5.8.

## 12. Interdictions 5.3

5.3 ne doit pas implémenter :

- récupération/synchronisation d'événements ;
- bootstrap année courante ;
- historique d'événements ;
- round-robin de synchronisation ;
- leases de synchronisation ;
- boucle année courante ;
- normalisation/ingestion Events ;
- fusion multisource ;
- UI complète Fournisseurs prévue en 5.9 ;
- scheduler périodique autonome parallèle à 5.4 ;
- moteur complet de quotas/cadence prévu en 5.5.

## 13. Validation

Le concept 5.3 a été explicitement validé par le mainteneur le 2026-08-12 après revue complète des décisions fonctionnelles et techniques.
