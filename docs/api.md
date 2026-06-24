# API Docs

The MVP integrates with OpenAI-compatible chat completion APIs. Local fallback planning, dry-run execution, and local patch-set application require no API.

When project API docs include endpoint lines such as ``GET /api/orders`` or ``GET /api/orders?status=open``, DevFlow records those API contracts in the project brief, implementation plan, task units, and delivery report. Inline endpoint paths can also surface query parameters like `status` and path parameters like `{id}`. DevFlow also recognizes GraphQL `query`, `mutation`, and `subscription` operations in inline notes and fenced `graphql` or `gql` blocks. Fenced `json` examples are summarized as API data models with top-level model names and field lists.

DevFlow also extracts operational API constraints that affect frontend delivery:

- Error cases: lines or sections describing failures, unavailable endpoints, partial data, invalid responses, stale data, timeouts, warnings, unauthorized responses, or forbidden responses.
- Auth requirements: lines or sections describing authentication, authorization, bearer tokens, cookies, sessions, API keys, permissions, OAuth, JWT, or secrets.

These become implementation units so AI execution can plan loading, empty, error, stale-data, unauthorized, and retry states instead of treating API docs as endpoint lists only.

```graphql
query OrdersDashboard($status: OrderStatus) {
  orders(status: $status) {
    id
    status
  }
}

mutation UpdateOrderStatus($id: ID!, $status: OrderStatus!) {
  updateOrderStatus(id: $id, status: $status) {
    id
    status
  }
}
```

Fenced OpenAPI JSON or YAML blocks are recognized when they contain `openapi` and `paths`:

- `paths` methods become API contracts.
- Path-level and operation-level `parameters` become API contract parameter notes for query, path, header, and cookie parameters.
- `components.schemas` become API data models.
- Operation `requestBody` content schemas become API request data models.
- Operation response content schemas become API response data models.
- `4xx`, `5xx`, and `default` responses become API error cases.
- `components.securitySchemes`, global `security`, and operation-level `security` become API auth requirements.

```yaml
openapi: 3.1.0
paths:
  /api/orders:
    get:
      summary: List orders
      responses:
        '200':
          description: OK
        '401':
          description: Unauthorized
```

Use fenced `json`, `yaml`, or `yml` blocks for structured OpenAPI extraction. Invalid OpenAPI-like YAML is reported as an open question so the API document can be corrected before implementation.

## Environment Variables

- `DEVFLOW_AI_API_KEY`: bearer token for the provider.
- `OPENAI_API_KEY`: fallback bearer token when `DEVFLOW_AI_API_KEY` is not set.
- `DEVFLOW_AI_BASE_URL`: provider base URL, default `https://api.openai.com/v1`.
- `DEVFLOW_AI_MODEL`: model name, default `gpt-4.1`.
- `DEVFLOW_AI_FIXTURE_PATH`: optional local file used to replay an AI response for tests and CI.

`DEVFLOW_AI_API_KEY` takes precedence over `OPENAI_API_KEY` when both are set. `DEVFLOW_AI_FIXTURE_PATH` takes precedence over live provider keys so deterministic tests and CI fixtures do not call an external model.

Run `dev-flow doctor --json` to inspect `aiProvider.mode`, `apiKeyEnvName`, `liveApiKeyEnvName`, `baseUrl`, `baseUrlSource`, `chatCompletionsUrl`, `model`, `modelSource`, and `fixtureOverridesLive` without making a provider request. Run `dev-flow smoke-provider --require-live` to make a minimal live request, ignore fixture replay, and write `.devflow/artifacts/live-provider-smoke.json` without exposing secret values.

## Endpoint

`POST {DEVFLOW_AI_BASE_URL}/chat/completions`

Provider contract tests use a local OpenAI-compatible HTTP server, so contributors can verify request shape, auth headers, response parsing, and error handling without a paid API key.

## Request Shape

```json
{
  "model": "gpt-4.1",
  "messages": [
    {
      "role": "system",
      "content": "You are DevFlow..."
    },
    {
      "role": "user",
      "content": "Create a frontend implementation plan..."
    }
  ],
  "temperature": 0.2
}
```

## Response Shape

```json
{
  "choices": [
    {
      "message": {
        "content": "# Implementation Plan..."
      }
    }
  ]
}
```

## Error Cases

- Non-2xx provider responses should throw an actionable error with status and body.
- Empty model responses should throw an explicit empty-plan error.
- Missing API key should not throw for planning or dry-run; the CLI should use deterministic fallback planning and dry-run patch proposals.
- `execute --apply --task <id>` requires an AI key or fixture unless `--patch-set <path>` is provided.
- `DEVFLOW_AI_FIXTURE_PATH` should bypass live provider calls and replay the file content as the model response.
