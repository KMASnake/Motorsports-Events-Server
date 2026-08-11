# ADR-0014 — Authentification de la console d'administration

Statut : Accepté

Date : 2026-08-11

## Contexte

La console utilise aujourd'hui un Bearer HMAC technique placé manuellement dans
`sessionStorage`. Ce mécanisme convient aux validateurs et intégrations, mais
ne constitue pas une authentification humaine acceptable. Le mainteneur a
validé un compte unique, une connexion identifiant/mot de passe, des sessions
serveur et des durées précises.

## Décision

- mot de passe hashé avec Argon2id et paramètres versionnés dans la chaîne PHC ;
- compte administrateur singleton initialisé uniquement par CLI ;
- sessions opaques dans PostgreSQL, token brut uniquement en cookie HttpOnly et
  empreinte SHA-256 en base ;
- durée d'inactivité d'une heure, maximum absolu de huit heures ;
- cookie `Secure` en production, `SameSite=Lax`, `Path=/`, sans `Domain` ;
- CSRF par double-submit cookie signé, lié à la session, en-tête personnalisé
  et contrôle d'origine ;
- protection globale du compte unique : cinq échecs en quinze minutes puis
  blocage de quinze minutes ;
- Bearer HMAC conservé comme authentification technique parallèle ;
- principal d'audit commun indiquant la méthode humaine ou technique ;
- aucun JWT d'authentification accessible au JavaScript et aucun Redis.

## Conséquences

Une migration versionnée ajoute compte, état anti-bruteforce et sessions. La
console ajoute `/login`, une garde React et un client HTTP cookie/CSRF. Les
scripts et validateurs HMAC continuent à fonctionner. Les nouvelles routes
auth ne sont pas des routes administratives ordinaires, mais appliquent leurs
propres contrôles d'origine, rate limiting et audit.

Le cookie CSRF est lisible par JavaScript uniquement parce qu'il n'est pas un
authentifiant ; le cookie de session reste HttpOnly. La production refuse une
configuration de cookie non Secure.

## Alternatives rejetées

- bcrypt : robuste mais moins moderne, mémoire non paramétrable et limite
  historique de taille d'entrée ;
- scrypt : solution de repli techniquement acceptable, mais Argon2id est la
  recommandation première ;
- JWT navigateur : révocation immédiate et confidentialité moins simples ;
- Redis : infrastructure prématurée pour un compte unique ;
- SameSite seul : protection CSRF insuffisante comme stratégie unique ;
- HMAC humain : expose une primitive technique et ne gère ni mot de passe, ni
  session, ni logout serveur.

## Références

- RFC 9106 — Argon2 Memory-Hard Function ;
- OWASP Password Storage Cheat Sheet ;
- OWASP Cross-Site Request Forgery Prevention Cheat Sheet ;
- MDN — attributs de `Set-Cookie`.

## Validation

Le mainteneur a explicitement validé le 2026-08-11 Argon2id et ses paramètres
initiaux, le double-submit CSRF signé, le modèle PostgreSQL, les variables
proxy/cookie et la coexistence HMAC/session.
