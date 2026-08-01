# Clés et identifiants

## Identifiants internes
Les entités utilisent des identifiants internes opaques. UUID/ULID ou équivalent
sont acceptables. Le choix doit :
- éviter la dépendance aux identifiants fournisseurs ;
- permettre une génération distribuée ;
- ne jamais être réutilisé.

## Identifiants externes
Les identifiants fournisseurs sont conservés dans `external_references` avec :
- provider_id ;
- external_type ;
- external_id ;
- canonical_type ;
- canonical_id ;
- confidence ;
- valid_from ;
- valid_until.

## Clés naturelles
Les noms, dates et numéros ne sont jamais utilisés seuls comme clé primaire.
Ils peuvent participer au rapprochement, pas à l'identité permanente.
