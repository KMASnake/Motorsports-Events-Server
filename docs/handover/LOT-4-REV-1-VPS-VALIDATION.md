# Validation VPS — lot 4 rev.1

## Candidat validé

- Version : `8.1.0-alpha.2-lot.4-rev.1`
- Branche : `agent/lot-4-rev-1-calendar`
- Commit : `dcbf76575a648082e98df9202f4b3b6506338515`
- Pull request : <https://github.com/KMASnake/Motorsports-Events-Server/pull/24>
- Date : 1er août 2026

## Environnement

Le candidat a été cloné dans
`/home/debian/motorsports-events-server-lot4-test` sur `vps-855f6d7e`.
Il a été lancé sous le projet Docker Compose isolé `mse-lot4-test`, avec une
base et des ports distincts de la production :

- interface : `127.0.0.1:3100` ;
- API : `127.0.0.1:3101` ;
- PostgreSQL : `127.0.0.1:55433`.

La production 2.7.0 n'a pas été modifiée.

## Résultats observés

L'API a répondu avec la version attendue, `status=ok` et
`checks.database=true`. L'interface a répondu avec succès. L'utilisateur a
ensuite testé l'interface depuis Windows au travers d'un tunnel SSH et a
confirmé l'intégralité de la checklist :

- calendrier affiché par défaut et vue liste disponible ;
- filtres, sélection et navigation mensuelle ;
- création, modification, duplication et suppression d'événements ;
- publication et dépublication ;
- comportement des API publique et d'administration ;
- page Championnats fonctionnelle sans régression ;
- rendu desktop accepté.

## Conclusion

Le lot 4 rev.1 est accepté par l'utilisateur et la PR #24 est prête à être
relue puis fusionnée dans `main`. Le clone VPS reste un environnement de test :
il ne doit pas être installé sur la production avec l'ancien `upgrade.sh`.
