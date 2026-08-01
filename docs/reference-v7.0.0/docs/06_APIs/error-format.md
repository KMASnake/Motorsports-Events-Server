# Format d'erreur

```json
{
  "error": {
    "code": "SESSION_TIME_INVALID",
    "message": "La fin de la séance doit être postérieure au début.",
    "status": 422,
    "correlationId": "01H...",
    "details": [
      {"field": "endsAt", "reason": "must_be_after_starts_at"}
    ]
  }
}
```

Le code est stable. Le message est lisible. Aucun secret ou détail interne
sensible ne doit être exposé.
