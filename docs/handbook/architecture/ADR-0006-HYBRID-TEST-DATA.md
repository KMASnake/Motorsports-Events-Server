# ADR-0006-HYBRID-TEST-DATA

Statut : Accepté

## Contexte

Une validation fonctionnelle ne doit dépendre ni d'une base de production, ni
d'un fournisseur disponible, ni d'une préparation manuelle difficile à
reproduire. Une interface peut sembler vide ou correcte alors que ses états
importants ne sont pas exercés.

## Décision

Chaque nouvelle version candidate embarque ou référence un générateur de
données adapté à son périmètre. Le jeu est reproductible, idempotent,
synthétique et dépourvu de secret. Il couvre les états nominaux et limites
nécessaires à la recette, notamment les erreurs, conflits et valeurs absentes
pertinents pour la fonction livrée.

La procédure de validation fournit systématiquement :

- la commande d'injection dans l'environnement isolé ;
- le volume et les catégories de données attendus ;
- les contrôles automatiques disponibles ;
- les vérifications manuelles à réaliser ;
- la commande de nettoyage de l'environnement de test.

Un dump de production ne doit jamais être commité. Si une donnée réaliste est
nécessaire, son identité est synthétisée, ses secrets supprimés et ses
intégrations neutralisées avant toute utilisation.

## Conséquences

Une fonctionnalité n'est pas prête pour validation utilisateur si son jeu de
données utile ou sa procédure d'injection manque. L'ajout du jeu fait partie du
périmètre de développement et de documentation de la version, pas d'une tâche
facultative réalisée après livraison.
