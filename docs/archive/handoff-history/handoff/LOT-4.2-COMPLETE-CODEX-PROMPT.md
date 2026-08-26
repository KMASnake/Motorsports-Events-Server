# Instructions Codex — Lot 4.2 complet

Travaille sur la branche :

```text
codex/lot-4.2-complete
```

Le Lot 4.2 est un package unique. Il ne dépend d'aucune rev.1 intermédiaire
validée. Les volets fonctionnel, graphique et données hybrides doivent être
développés ensemble.

Lis dans cet ordre :

1. `CODEX.md`
2. `PROJECT-STATUS.json`
3. `docs/handoff/LOT-4.2-CALENDAR-INTERACTIVE-SPEC.md`
4. `docs/handoff/LOT-4.2-GRAPHICS-SPEC.md`
5. `docs/handoff/LOT-4.2-HYBRID-DATA-SPEC.md`
6. `docs/handoff/LOT-4.2-ACCEPTANCE.md`
7. `docs/handoff/LOT-4.2-GRAPHICS-ACCEPTANCE.md`
8. `docs/handoff/LOT-4.2-DATA-SECURITY-ACCEPTANCE.md`
9. `docs/handoff/LOT-4.2-ADR.md`
10. `docs/handoff/LOT-4.2-DATA-ADR.md`
11. `docs/handoff/LOT-4.2-CORRECTIONS-SPEC.md`
12. `docs/handoff/LOT-4.2-CORRECTIONS-ACCEPTANCE.md`
13. `docs/handoff/LOT-4.2-CORRECTIONS-ADR.md`
14. les maquettes validées.

Mission fonctionnelle :

- vues Mois, Semaine, Jour et Agenda ;
- glisser-déposer ;
- redimensionnement ;
- création rapide ;
- duplication ;
- mutations optimistes avec rollback ;
- avertissement simple de conflit.

Mission graphique :

- logo Motorsports Events fidèle à la maquette ;
- logos officiels disponibles des championnats ;
- drapeaux des pays ;
- logos de circuits disponibles ;
- fallbacks ;
- provenance des assets ;
- fidélité cible >= 98 %.


Mission corrections fournisseur :

- toute modification manuelle d'un événement fournisseur crée ou met à jour
  une correction locale ;
- la correction apparaît immédiatement dans la page Corrections ;
- la valeur fournisseur reste conservée ;
- la synchronisation ne doit jamais écraser l'override ;
- tout changement fournisseur sous override crée un conflit ;
- l'administrateur peut accepter la valeur fournisseur ou conserver la valeur locale ;
- l'API publique expose uniquement la valeur effective ;
- un événement entièrement manuel ne crée pas de correction fournisseur.

Mission données hybrides :

- export manuel sécurisé ;
- import dans une base temporaire isolée ;
- conservation des données sportives réalistes ;
- remplacement des identités par des données synthétiques ;
- suppression des secrets et sessions ;
- neutralisation des intégrations ;
- vérification bloquante ;
- générateur synthétique déterministe ;
- aucun dump dans Git.

Contraintes :

- ne jamais écrire vers la production ;
- ne jamais commiter de dump ;
- ne jamais conserver de secret réel ;
- conserver le calendrier, la liste, le CRUD, l'API publique et l'API admin ;
- ne pas déclarer le lot terminé sans builds, Docker, tests, contrôles de
  sécurité, captures et documentation.

Avant de conclure, fournis :

- fichiers modifiés ;
- choix techniques ;
- dépendances ;
- inventaire des assets ;
- inventaire des données conservées/remplacées ;
- commandes exécutées ;
- résultats des builds et tests ;
- rapport d'anonymisation ;
- rapport de vérification ;
- captures 1440 × 900 ;
- écarts résiduels ;
- avancement global ;
- tests manuels Windows.


Exigences supplémentaires Corrections :

- mettre en évidence chaque champ corrigé individuellement ;
- afficher côte à côte valeur fournisseur et valeur locale ;
- afficher badges Corrigé et Conflit ;
- afficher le nombre de champs corrigés par événement ;
- regrouper les corrections par événement ;
- une modification d'un événement manuel ne doit jamais créer une correction ;
- un événement manuel ne doit pas apparaître dans la page Corrections ;
- aucune correction rétroactive automatique lors d'un futur rattachement à un fournisseur.
