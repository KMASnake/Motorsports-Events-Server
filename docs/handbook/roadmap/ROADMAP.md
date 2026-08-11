# Roadmap

- Lot 4.1 : validé
- Lot 4.2 : validé
- Lot 4.3 : validé utilisateur, fusionné dans `main` via PR #27 le 2026-08-11
- Lot 4 : terminé fonctionnellement
- Lot 4.4 : authentification de la console d'administration, décisions fonctionnelles validées, développement non commencé
- Lot suivant : Fournisseurs et cœur de synchronisation API, à cadrer avec le mainteneur avant mise à jour détaillée de la roadmap
- Lot 5 : futur

## Lot 4.4 — Authentification administration

La duplication d'Événements existe déjà et convient au mainteneur : elle ne constitue plus le périmètre du Lot 4.4.

Décisions validées avec le mainteneur :

- un seul compte administrateur pour cette première version ;
- création du compte initial via une commande d'initialisation dédiée (`create-admin` ou équivalent) ;
- mot de passe stocké uniquement sous forme de hash sécurisé ;
- aucune interface de gestion multi-utilisateurs ni gestion complexe des rôles dans ce lot ;
- page de connexion avec identifiant et mot de passe ;
- session gérée côté serveur ;
- cookie de session `HttpOnly`, `Secure` et `SameSite` ;
- aucun JWT ou secret HMAC exposé au JavaScript du navigateur ;
- redirection vers la page de connexion pour les pages d'administration protégées ;
- retour vers la destination initialement demandée après authentification lorsque cela est sûr ;
- déconnexion avec invalidation immédiate de la session côté serveur ;
- durée absolue maximale d'une session : 8 heures ;
- expiration après 1 heure d'inactivité, renouvelée par l'activité sans dépasser la limite absolue ;
- conservation de la connexion après fermeture/réouverture du navigateur tant que la session reste valide ;
- protection anti-bruteforce : 5 échecs sur une fenêtre de 15 minutes entraînent un blocage temporaire de 15 minutes ;
- message d'échec générique ne révélant pas si le compte existe ;
- journalisation des échecs et blocages sans mot de passe ni secret ;
- une connexion réussie remet le compteur d'échecs à zéro ;
- pas de CAPTCHA, de blocage permanent ni de blocage fondé uniquement sur l'adresse IP dans cette première version ;
- le mécanisme HMAC existant reste un mécanisme technique/API et n'est pas présenté comme moyen de connexion utilisateur.

Ces décisions doivent maintenant être transformées en spécification technique, critères d'acceptation et analyse d'impact avant implémentation.

## Suite — Fournisseurs et synchronisation

Après l'authentification, le prochain chantier souhaité est la page Fournisseurs avec le cœur de synchronisation API, notamment la gestion des quotas mensuels et par minute ainsi que la persistance/reprise d'un curseur de synchronisation.

Les concepts détaillés de ce chantier ne sont pas encore figés dans la roadmap : ils devront d'abord être discutés et validés avec le mainteneur avant documentation ou implémentation.
