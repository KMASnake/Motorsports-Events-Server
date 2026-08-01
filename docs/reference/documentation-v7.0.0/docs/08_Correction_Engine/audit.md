# Audit

Chaque action enregistre :
- acteur ;
- rôle ;
- action ;
- cible ;
- correction ;
- état avant/après ;
- motif ;
- date ;
- correlationId ;
- source de la commande.

Actions minimales :
- correction.created
- correction.submitted
- correction.reviewed
- correction.approved
- correction.rejected
- override.activated
- reversion.proposed
- override.revoked
- correction.expired
