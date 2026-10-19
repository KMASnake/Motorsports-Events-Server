# ADR-0027 — Résolution canonique Meeting/Event

Statut : candidat F5-5, en attente de validation mainteneur.

## Décision

Meeting porte l'identité canonique d'une épreuve et la référence vers
`ChampionshipSeason`. Event porte l'identité canonique d'une session via
`events.normalized_uuid` et hérite de Season exclusivement par
`Event -> meeting_events -> Meeting -> ChampionshipSeason`.
`events.id`, `events.championship_id` et `circuit_id` restent des champs de
compatibilité ; aucun `events.championship_season_id` n'est créé.

Un Event canonique appartient exactement à un Meeting et leurs Championships
doivent être identiques. Ces invariants sont différés jusqu'au commit afin que
la création atomique Event + relation reste possible, tout en refusant tout
orphelin persistant.

Meeting et Event peuvent référencer un Venue et un Layout. Le Layout est
toujours scoped par son Venue. Leur Venue peut différer, notamment pour les
spéciales et parcs d'assistance. `events.session_type_key` référence le registre
data-driven `session_types`; une valeur inconnue devient `other` sans écraser le
libellé source.

## Résolution et décisions

Un lien source durable précède toute heuristique. Les recherches structurelles
sont scoped par ChampionshipSeason UUID, jamais par l'année seule, et un Event
enfant n'est recherché que dans son Meeting parent résolu. Une ambiguïté ou un
parent non résolu produit `REVIEW_REQUIRED` sans Event, lien source, relation ou
publication.

Les candidats ont une révision. Les décisions append-only portent la révision
attendue, une clé d'idempotence et un fingerprint de la requête logique. Les
états terminaux sont immuables. Les transactions verrouillent candidat,
identité structurelle et parent avant mutation.

Une décision `create` initialise les champs du nouvel objet canonique. Une
décision `link` établit uniquement le lien durable vers un objet existant :
elle ne réécrit ni ses champs canoniques ni son état public. Une issue de
publication non matérialisée (`review_required`, kill switch ou blocage)
annule transactionnellement la décision terminale et laisse le candidat
réessayable.

## Frontières

F5-5 ne met pas en œuvre le merge de deux identités canoniques, la priorité
champ par champ entre fournisseurs, Results/Entry/Team/Person/Standings,
l'activation provider, l'acquisition ou le scheduler. Ces sujets restent dans
les phases ultérieures explicitement autorisées.
