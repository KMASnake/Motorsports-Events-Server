# Lot 5.6-B — Acquisition adaptateur sécurisée

Date : 2026-08-15  
Statut : **CORRIGÉ APRÈS AUDIT — EN ATTENTE DE RÉ-AUDIT MAINTENEUR**

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

## Corrections après audit

- WRC reste dans `OcBlackTopAdapter` mais utilise la stratégie générique
  `season-rallies-v1` et le modèle documenté
  `/{series}/seasons/{year}` ; aucun test du nom WRC n’existe dans le moteur ;
- une page vide ne prouve plus jamais seule la terminaison : priorité à
  `has_next_page`, puis `next_page`, puis `total_pages`, avec arrêt bloquant
  si ces preuves se contredisent ;
- les HTTP 400, 404 et 410 génériques ne deviennent plus `cursor_invalid` ;
  le restart saison exige une preuve d’invalidation fournisseur explicite ;
- TheSportsDB v1 impose une clé dans le chemin et est donc incompatible avec
  AC-5.6-161. L’adaptateur utilise l’API v2 documentée, `X-API-KEY`,
  `/all/leagues` et `/schedule/league/{league}/{season}`. Les configurations
  v1 historiques sont normalisées en mémoire vers v2 avant le transport.

## Sécurité HTTP

Les deux adaptateurs utilisent exclusivement `fetchProviderJson` dans
`providerHttp.ts`. Cette frontière conserve HTTPS obligatoire, allowlist exacte,
refus des redirections, timeout de huit secondes, lecture streaming bornée à
1 000 000 octets, compteur de requêtes et quota gate 5.5. Les erreurs
normalisées n'incorporent ni réponse fournisseur ni credential. La décision
TheSportsDB est fondée sur la documentation officielle :
<https://www.thesportsdb.com/docs_api_guide>.

## Preuves exécutées

- typecheck API : PASS ;
- build API : PASS ;
- suite API complète : 190/190 PASS ;
- suite ciblée acquisition/sécurité : 71/71 PASS ;
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
- WRC saisonnier via OCBlackTop sans adaptateur séparé : PASS ;
- page vide avec `next_page` ou `has_next_page=true` : non terminale, PASS ;
- métadonnées de pagination contradictoires : bloquées, PASS ;
- HTTP 400/404/410 génériques : jamais `cursor_invalid`, PASS ;
- TheSportsDB v2 : secret uniquement dans `X-API-KEY`, absent de l’URL, du
  résultat sanitizé et de l’erreur sérialisée, PASS.

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
