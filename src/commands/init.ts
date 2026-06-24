import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileExists } from "../core/fs.js";
import { configPath, defaultConfig, loadConfig, writeConfig, type DevFlowConfig } from "../core/config.js";
import type { FlagMap } from "../core/args.js";

function createStarterDocs(config: DevFlowConfig): Record<string, string> {
  return {
    [config.requirementsPath]: `# Requirements

Describe the product goal, users, scope, constraints, and acceptance criteria. Keep this concrete enough for an AI coding agent to map requirements to files and verification.

## Goal

- What should be true when this frontend work is delivered?

## Users And Roles

- Primary user:
- Secondary users:
- Permissions or role differences:

## In Scope

- 

## Out Of Scope

- 

## User Stories

- As a user, I want to ... so that ...

## Acceptance Criteria

- [ ] Primary flow can be completed.
- [ ] Loading, empty, error, and success states are represented.
- [ ] The UI is usable at desktop and mobile widths.
- [ ] Existing verification commands pass.

## Constraints

- Technical constraints:
- Product constraints:
- Accessibility requirements:
- Performance or browser requirements:

## Verification Notes

- Commands to run:
- Manual QA paths:
- Known risks:
`,
    [config.uiPath]: `# UI Notes

Describe screens, layouts, components, interaction states, responsive behavior, design assets, and visual constraints.

## Design Assets

Reference screenshots, wireframes, exports, or Figma/Zeplin handoff links so DevFlow can record them in the project brief.

![Primary screen wireframe](assets/primary-screen.png)

[Figma design](https://www.figma.com/design/example/project)

## Screens

- Screen name:
- Route or entry point:
- Primary user goal:

## Components

- Component:
- Props or data needed:
- Reusable states:

## States

- Loading:
- Empty:
- Error:
- Success:

## Interactions

- Primary action:
- Secondary actions:
- Disabled or blocked behavior:
- Keyboard behavior:

## Responsive Behavior

- Desktop:
- Tablet:
- Mobile:

## Accessibility

- Landmarks:
- Labels:
- Focus behavior:

## Visual Tokens

- Color roles:
- Typography:
- Spacing:
- Iconography:
`,
    [config.apiPath]: `# API Docs

Describe HTTP endpoints, GraphQL operations, schemas, auth, errors, loading behavior, and integration constraints. Include concrete method/path lines, GraphQL query or mutation snippets, JSON examples, linked local OpenAPI/Swagger files, or fenced OpenAPI JSON/YAML when possible.

[OpenAPI spec](openapi.yaml)

## Authentication

- Authorization:
- Session or token expiry:
- Unauthorized behavior:

## Endpoints

- GET /api/example
- POST /api/example

## GraphQL Operations

\`\`\`graphql
query ExampleStatus($id: ID!) {
  example(id: $id) {
    id
    status
  }
}
\`\`\`

## Data Models

\`\`\`json
{
  "example": {
    "id": "ex_123",
    "status": "ready"
  }
}
\`\`\`

## Error Cases

- 400 validation error:
- 401 unauthorized:
- 403 forbidden:
- 404 not found:
- 409 conflict:
- 5xx unavailable:

## Loading And Caching

- Loading behavior:
- Empty response behavior:
- Stale data behavior:
- Retry behavior:

## OpenAPI JSON Or YAML

Link a local OpenAPI/Swagger file above or paste fenced OpenAPI JSON/YAML here when available.

\`\`\`yaml
openapi: 3.1.0
paths: {}
\`\`\`
`
  };
}

export async function runInit(_flags: FlagMap): Promise<void> {
  const hasConfig = await fileExists(configPath);
  const config = hasConfig ? await loadConfig() : defaultConfig();
  const createdDocs: string[] = [];
  const existingDocs: string[] = [];

  await mkdir(config.artifactsDir, { recursive: true });
  if (!hasConfig) {
    await writeConfig(config);
  }

  for (const [path, content] of Object.entries(createStarterDocs(config))) {
    if (await fileExists(path)) {
      existingDocs.push(path);
      continue;
    }

    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, "utf8");
    createdDocs.push(path);
  }

  console.log("DevFlow project initialized.");
  console.log(`Config: ${configPath}${hasConfig ? " (existing)" : ""}`);
  console.log(`Artifacts: ${config.artifactsDir}`);
  console.log(`Starter docs: ${createdDocs.length} created, ${existingDocs.length} existing`);
}
