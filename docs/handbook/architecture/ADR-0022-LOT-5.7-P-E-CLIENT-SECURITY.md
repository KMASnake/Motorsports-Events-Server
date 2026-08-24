# ADR-0022 — Sécurité client de la Preview 5.7-P-E

Date : 2026-08-24
Statut : correction d’intégration terminée, revalidation mainteneur/VPS requise

## Décision

La frontière cliente Preview utilise des clés Bearer machine-to-machine
distinctes de l’authentification administrative. Le secret complet est généré
aléatoirement et retourné une seule fois. PostgreSQL conserve uniquement un
préfixe de recherche borné et un digest HMAC-SHA-256 calculé avec un pepper
serveur indépendant de la base. Toute vérification de digest utilise une
comparaison constant-time, y compris pour un préfixe inconnu.

Les quatre scopes read sont distincts des entitlements championnat. Les droits
sont relus pour chaque requête et les cursors signés sont liés au client, jamais
à une clé physique. Les collections et `/changes` filtrent en SQL ; un filtre
explicitement interdit reçoit 403 et un UUID inaccessible 404.

Les limites par défaut sont 60 requêtes/minute et 10 000/jour UTC par client.
Les compteurs PostgreSQL sont atomiques. Une réponse 304 reste chargée et une
5xx rembourse la charge journalière. Les transitions client, clé, droits et
limites sont des opérations ACP protégées et auditées avec redaction du digest.

## Déploiement et frontière

La migration 0028 est additive et son DOWN refuse toute donnée client. Le
plugin D n’est enregistré derrière E que si `PREVIEW_API_ENABLED=true`; la
valeur par défaut reste `false`. Cette décision n’active donc pas la visibilité
Production, n’onboarde aucun client externe et n’autorise pas 5.7-P-F.

## Réouverture VPS et correction d’intégration

La validation VPS réelle du 2026-08-24 a confirmé la migration 0028, E01-E18 et
le fonctionnement Preview OFF, mais a rouvert la validation E : l’assemblage
complet enregistrait deux fois les lectures Event et Championship lorsque
Preview était activée.

La correction conserve un seul namespace `/api/v1`. Preview OFF enregistre les
lectures historiques. Preview ON remplace uniquement les quatre GET en collision
par les lectures Preview sécurisées, conserve les routes admin/write et ajoute
les lectures Meeting et Changes sans collision. L’assemblage partagé avec
`server.ts` est couvert dans les deux modes.

La correction est terminée, mais E n’est pas revalidé mainteneur et le VPS
n’est pas revalidé. La migration 0028 reste inchangée. Aucun appel fournisseur
réel et aucun crédit fournisseur n’ont été consommés.

Cette validation n’autorise ni 5.7-P-F, ni l’activation Preview en Production,
ni l’onboarding d’un client externe, ni le Lot 5.7 complet, ni 5.8+, ni le
merge vers `main`.
