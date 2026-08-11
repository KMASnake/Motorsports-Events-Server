# Lot 4.4 — Critères d'acceptation de la duplication

Date : 2026-08-11

Statut : `phase-0-specification-complete-awaiting-maintainer-validation`

## Cadrage Phase 0

- [x] duplication uniquement ;
- [x] parcours de formulaire avant persistance ;
- [x] règles champ par champ documentées ;
- [x] solution Web-only comparée à un endpoint dédié ;
- [x] absence de besoin de migration démontrée ;
- [x] stratégie de données synthétiques et de tests définie ;
- [ ] cadrage validé explicitement par le mainteneur.

## Parcours et formulaire à valider en Phase 1

- [ ] action Dupliquer accessible depuis le détail ;
- [ ] action Dupliquer accessible depuis la liste ;
- [ ] sélection calendrier puis détail permet la duplication ;
- [ ] formulaire existant ouvert en mode nouvelle copie non enregistrée ;
- [ ] aucun POST avant la soumission explicite ;
- [ ] annulation sans création ni audit ;
- [ ] nom prérempli avec suffixe ` — copie` ;
- [ ] championnat, circuit, catégorie, description et `session_title`
  préremplis depuis les valeurs effectives ;
- [ ] début et fin vides ;
- [ ] statut initial `draft` et publication initiale désactivée ;
- [ ] tous les champs métier autorisés restent modifiables ;
- [ ] `session_title` peut être conservé, modifié, choisi ou créé ;
- [ ] aucun champ Type de session ni interface multi-Sessions.

## Indépendance métier et technique

- [ ] nouvel ID généré ;
- [ ] nouveau slug unique généré ;
- [ ] origine `manual` ;
- [ ] `provider_key` absent/null ;
- [ ] `external_id` absent/null ;
- [ ] aucune correction copiée ;
- [ ] aucun override copié ;
- [ ] aucun audit historique copié ;
- [ ] timestamps propres à la copie ;
- [ ] source inchangée après création ;
- [ ] modification ou synchronisation ultérieure de la source sans effet sur
  la copie ;
- [ ] modification ultérieure de la copie sans effet sur la source.

## Temps et validation

- [ ] nouvelle date obligatoire ;
- [ ] fin facultative et supérieure ou égale au début ;
- [ ] saisie locale convertie en ISO avec offset explicite ;
- [ ] stockage UTC vérifié ;
- [ ] cas traversant minuit validé ;
- [ ] transition DST validée ;
- [ ] référence championnat inconnue rejetée ;
- [ ] référence circuit inconnue rejetée ;
- [ ] erreur serveur sans persistance partielle.

## Sécurité, audit et contrat

- [ ] `401` sans jeton, invalide ou expiré ;
- [ ] `403` sans rôle administrateur ;
- [ ] administrateur autorisé ;
- [ ] aucune métadonnée technique acceptée dans le POST ;
- [ ] une seule entrée d'audit pour la création réussie ;
- [ ] aucun secret ou jeton dans l'audit ;
- [ ] aucun audit au simple clic sur Dupliquer ou à l'annulation ;
- [ ] API publique expose la copie selon statut/publication et sans métadonnée
  fournisseur ;
- [ ] contrat public existant inchangé.

## Interface et non-régression

- [ ] scénario Chromium duplication manuelle ;
- [ ] scénario Chromium duplication fournisseur avec valeur effective ;
- [ ] scénario Chromium annulation ;
- [ ] scénario Chromium erreur serveur ;
- [ ] fonctionnement desktop 1440×900 et 1280×720 ;
- [ ] fonctionnement mobile déjà couvert par le formulaire Event ;
- [ ] calendrier et liste affichent la copie après création ;
- [ ] Corrections n'affiche pas la copie manuelle ;
- [ ] non-régression complète du Lot 4.3 ;
- [ ] lint, typecheck, tests API/Web, builds API/Web/Types et Docker réussis ;
- [ ] CI verte sur le SHA candidat exact ;
- [ ] recette Windows et commandes du jeton fournies ;
- [ ] validation explicite du mainteneur avant fusion.

## Exclusions contrôlées

Aucun critère ni test de récurrence, série, conflit ou chevauchement ne doit
être ajouté au Lot 4.4.

## Données de recette futures

Le jeu synthétique Phase 1 devra être reproductible et idempotent. Il devra
contenir au minimum :

- un Événement manuel avec `session_title` ;
- un Événement fournisseur sans override ;
- un Événement fournisseur avec overrides actifs sur des champs copiables ;
- une suggestion d'intitulé existante et une valeur inédite à créer ;
- des dates de destination couvrant UTC, minuit et DST ;
- des identités et secrets exclusivement factices.

La recette documentera systématiquement injection, résultats attendus,
contrôles manuels, commandes de jeton administrateur et nettoyage Docker.
