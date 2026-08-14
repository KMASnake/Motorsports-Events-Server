# Lot 5.6-B — Acquisition adaptateur sécurisée

Date : 2026-08-15  
Statut : **IMPLÉMENTÉ — EN ATTENTE D'AUDIT MAINTENEUR**

## Périmètre livré

- contrat source d'une unité acquise, sans normalisation métier 5.7 ;
- résultat à complétude explicite : `progress`, `complete` ou
  `cursor_invalid` ;
- anomalies élémentaires isolables et anomalies structurelles bloquantes ;
- curseur page borné, mémoire des pages visitées et détection de boucle ;
- terminaison OCBlackTop sur preuve de pagination et terminaison TheSportsDB
  sur collection mono-requête ;
- reprise d'un curseur fournisseur refusé à la plus petite unité sûre : la
  saison concernée ;
- validation défensive des identités, dates, saisons et intervalles ;
- sanitization et taille bornée des éléments avant toute exposition au futur
  moteur transactionnel ;
- propagation de l'annulation scheduler dans l'unique frontière HTTP existante
  `providerHttp.ts` ;
- délégation inchangée au quota gate 5.5 et absence de persistance/checkpoint,
  réservés à 5.6-C.

## Sécurité HTTP

Les deux adaptateurs utilisent exclusivement `fetchProviderJson` dans
`providerHttp.ts`. Cette frontière conserve HTTPS obligatoire, allowlist exacte,
refus des redirections, timeout de huit secondes, lecture streaming bornée à
1 000 000 octets, compteur de requêtes et quota gate 5.5. Les erreurs
normalisées n'incorporent ni réponse fournisseur ni credential.

## Preuves exécutées

- typecheck API : PASS ;
- build API : PASS ;
- suite API complète : 175/175 PASS ;
- suite ciblée acquisition/sécurité : 56/56 PASS ;
- pagination OCBlackTop multi-pages et terminaison explicite : PASS ;
- collection TheSportsDB vide explicitement complète : PASS ;
- anomalie élément isolée sans perte des éléments valides : PASS ;
- payload structurel invalide ou trop volumineux : arrêt bloquant, PASS ;
- pagination bouclante : arrêt bloquant, PASS ;
- curseur repris refusé : restart saison uniquement, PASS ;
- quota/HTTP 429 et parsing invalide : `complete=false`, PASS ;
- canari secret absent de l'erreur sérialisée : PASS ;
- annulation scheduler propagée : PASS ;
- dates source 1969, 1950 et 1900 : PASS.

## Acceptance couverte à ce stade

- AC-5.6-073 : contrat de reprise saison sur curseur invalidé ;
- AC-5.6-080 et AC-5.6-081 : complétude exclusivement sur terminaison certaine ;
- AC-5.6-090 et AC-5.6-091 : séparation isolable/bloquante au niveau adaptateur ;
- AC-5.6-100 à AC-5.6-102 : dates pré-1970 sans timestamp positif ;
- AC-5.6-150 à AC-5.6-153 : validation, bornes et pagination hostile ;
- AC-5.6-156 à AC-5.6-161 : frontière HTTP ADR-0016 et absence de fuite.

Les garanties transactionnelles, le checkpoint durable, le rollback et la
persistance des anomalies ne sont pas revendiqués ici : ils appartiennent à
5.6-C et aux sous-lots suivants.

## Gate

STOP avant 5.6-C. Le Lot 5.6 global reste non validé, non clôturé et non
fusionnable. `authorized_sub_lot` reste `5.6` et les Lots 5.7+ restent
interdits.
