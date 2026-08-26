# Lot 5.6-D — Corrections après audit mainteneur

Date : 2026-08-15  
Statut : **CORRIGÉ — RÉ-AUDIT REQUIS**

## Décisions appliquées

1. Les fournisseurs actuels exposent un parcours saisonnier global et aucun
   paramètre temporel documenté. Un seul work unit `current_global` est donc
   exécuté ; les entités sont classées durablement en hot/future après
   persistance, sans requête dupliquée.
2. L’état deep history utilise exclusivement les totaux cumulés du traversal
   logique 5.6-C. La dernière page ne décide jamais seule du vide saisonnier.
3. Saison et phase sont calculées depuis l’état durable et la clock dans le
   fuseau fournisseur. Une contradiction est rejetée avant traversal, quota et
   adaptateur.
4. Finalization exige une cible non terminée dans la fenêtre de grâce. Après la
   grâce, l’anomalie reste gérée sans rafraîchissement infini.

## Preuves ciblées PostgreSQL

- J+10=`current_hot`, J+90 et J+365=`current_future`, un seul appel fournisseur ;
- saison 1995 : pages 40 + 35 + terminale vide, total 75 et compteur vide à 0 ;
- état 1995 contre demande 2005 : rejet avant traversal/gate/provider ;
- année 1995 complète : passage durable à 1994 ;
- finalization absente sans cible, prioritaire dans la fenêtre, absente après
  fin explicite ou dépassement de grâce ;
- current reste disponible pendant deep history ;
- suites 5.6-A, 5.6-B, 5.6-C et 5.6-D vertes.

STOP avant 5.6-E. Le Lot 5.6 global reste non validé et non fusionnable.

## Corrections du ré-audit final

- `current_global` remplace `current_hot` comme work class réellement exécuté.
  Le scheduler donne priorité aux streams current ayant au moins une entité hot,
  seulement après application de l’éligibilité, du quota et du backoff 5.5 ;
- la migration `0021_lot56_current_global_finalization_queue` conserve ce nom
  durable et le dernier millésime finalization exécuté ;
- les cibles finalization sont groupées par saison. Au 5 janvier 2027, une cible
  du 20 décembre 2026 produit une unité saison 2026, puis une cible 2027 produit
  une unité distincte saison 2027 ;
- en l’absence de cible, `current_global` est choisi sans appeler le fournisseur
  au titre de finalization ;
- les cinq observations comparables les plus récentes sont sélectionnées avant
  la médiane, ce qui empêche un historique ancien abondant de dominer trois
  événements récents cohérents.
