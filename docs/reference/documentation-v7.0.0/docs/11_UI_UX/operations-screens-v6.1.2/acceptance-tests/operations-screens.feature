Feature: Écrans opérationnels v6.1.2

  Scenario: Rechercher un circuit
    Given la page Circuits est chargée
    When je saisis "Silverstone"
    Then seules les lignes correspondantes sont affichées
    And la recherche est accessible au clavier

  Scenario: Créer une clé API
    Given je possède la permission api_keys:create
    When je crée une clé avec des scopes valides
    Then le secret complet est affiché une seule fois
    And il n'est plus récupérable après fermeture

  Scenario: Détecter une métrique obsolète
    Given une métrique n'a pas été reçue depuis plus de deux intervalles
    Then la carte du service affiche l'état stale
    And l'heure de la dernière donnée reste visible

  Scenario: Corréler des journaux
    Given une ligne possède un correlation_id
    When je clique sur ce correlation_id
    Then le filtre correspondant est appliqué
    And la période courante est conservée

  Scenario: Respecter les permissions
    Given mon rôle est en lecture seule
    Then les actions d'écriture sont absentes ou désactivées
    And leur indisponibilité est expliquée de façon accessible
