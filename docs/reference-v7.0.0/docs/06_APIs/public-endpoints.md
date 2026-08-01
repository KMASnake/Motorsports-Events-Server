# Endpoints publics v6.1

- `GET /disciplines`
- `GET /disciplines/{disciplineId}`
- `GET /championships?disciplineId=`
- `GET /categories?championshipId=`
- `GET /seasons?championshipId=&categoryId=`
- `GET /events?disciplineId=&championshipId=&categoryId=&seasonId=`
- `GET /events/{eventId}`
- `GET /sessions?eventId=&championshipId=&categoryId=&from=&to=`

`categoryId` est facultatif. Son absence ne signifie pas « toutes les catégories » lorsqu'un filtre
explicite `categoryId=null` est utilisé ; ce cas cible les saisons directes du championnat.
