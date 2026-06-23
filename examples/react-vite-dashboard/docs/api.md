# API Docs

The example uses static local data, but the frontend shape mirrors these future endpoints.

## Endpoints

- `GET /api/release/summary`
- `GET /api/release/deployments`
- `GET /api/release/incidents`
- `GET /api/release/services`
- `GET /api/release/contracts`

## Data Models

```json
{
  "summary": {
    "releaseHealth": 86,
    "deployConfidence": "guarded",
    "apiLatencyP95": 184,
    "incidentPressure": 3
  }
}
```

```json
{
  "deployment": {
    "service": "Checkout Gateway",
    "owner": "Payments",
    "environment": "Production",
    "status": "blocked",
    "build": "2026.06.23-rc.4",
    "nextAction": "Resolve contract drift"
  }
}
```

## Error Cases

- Summary endpoint unavailable: keep the last known values and show stale data state.
- Deployment endpoint returns partial data: show available services and flag missing ownership.
- Incident endpoint fails: show incident pressure as unknown and block production approval.
- Contract endpoint fails: mark API readiness as warning.

## Authentication

- Future API requests use Authorization: Bearer release-session-token.
- Expired sessions return 401 and should show a reconnect prompt before allowing deployment approval.
