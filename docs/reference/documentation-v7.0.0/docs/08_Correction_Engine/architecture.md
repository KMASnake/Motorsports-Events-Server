# Architecture

## Composants
- Correction Command Service
- Correction Validation Service
- Review Workflow
- Override Manager
- Reversion Evaluation Service
- Conflict Integration
- Synchronization Guard
- Audit Service
- Notification Service

## Flux général
1. Un utilisateur crée une correction.
2. Le système valide la cible et le champ.
3. La correction est soumise.
4. Un utilisateur autorisé l'approuve ou la rejette.
5. L'override devient actif.
6. Les synchronisations futures respectent cet override.
7. Le système réévalue périodiquement sa nécessité.
8. Une réversion peut être proposée, approuvée puis appliquée.
