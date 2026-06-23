import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  assessDeliveryRisks,
  createProjectBrief,
  extractApiAuthRequirements,
  extractApiContracts,
  extractApiDataModels,
  extractApiErrorCases,
  extractDesignAssets,
  extractUiStateChecklist
} from "./brief.js";
import type { ProjectContext } from "./context.js";
import type { StackProfile } from "./stack.js";

const context: ProjectContext = {
  requirementsPath: "docs/requirements.md",
  requirements: [
    "# Requirements",
    "",
    "- As a user, I want saved filters so that I can return to focused views.",
    "- [ ] Filters persist after refresh.",
    "",
    "## Constraints",
    "",
    "- Must support offline fallback data."
  ].join("\n"),
  uiPath: "docs/ui.md",
  ui: "# UI Notes\n\n![Filter table wireframe](assets/filter-table.png)\n\n- Desktop and mobile responsive table.",
  apiPath: "docs/api.md",
  api: "# API Docs\n\n- `GET /filters`\n- Error responses include message.\n\n```json\n{\"filter\":{\"id\":\"open\",\"label\":\"Open\"}}\n```"
};

const stack: StackProfile = {
  packageManager: "npm",
  runtimes: ["Node.js", "TypeScript"],
  frameworks: ["React"],
  buildTools: ["Vite"],
  styling: ["Tailwind CSS"],
  testing: ["Vitest"],
  scripts: {
    check: "vitest run && tsc --noEmit"
  },
  sourceDirectories: ["src"],
  configFiles: ["tsconfig.json"],
  notes: []
};

test("createProjectBrief extracts document signals and stack context", () => {
  const brief = createProjectBrief(context, stack);

  assert.deepEqual(brief.sourceDocuments, {
    requirementsPath: "docs/requirements.md",
    uiPath: "docs/ui.md",
    apiPath: "docs/api.md"
  });
  assert.equal(brief.stack.frameworks[0], "React");
  assert.match(brief.signals.requirements.join("\n"), /saved filters/);
  assert.deepEqual(brief.designAssets, [
    {
      source: "ui-markdown-image",
      kind: "local",
      altText: "Filter table wireframe",
      reference: "assets/filter-table.png",
      resolvedPath: "docs/assets/filter-table.png",
      exists: false
    }
  ]);
  assert.deepEqual(brief.uiStateChecklist, [
    {
      kind: "responsive",
      sourceLine: 5,
      summary: "Desktop and mobile responsive table."
    }
  ]);
  assert.match(brief.openQuestions.join("\n"), /UI design asset was referenced but not found/);
  assert.deepEqual(brief.apiContracts, [
    {
      method: "GET",
      path: "/filters",
      sourceLine: 3,
      summary: "GET /filters"
    }
  ]);
  assert.deepEqual(brief.apiDataModels, [
    {
      name: "filter",
      sourceLine: 6,
      fields: ["id", "label"],
      summary: "filter object"
    }
  ]);
  assert.deepEqual(brief.apiErrorCases, [
    {
      sourceLine: 4,
      summary: "Error responses include message."
    }
  ]);
  assert.deepEqual(brief.apiAuthRequirements, []);
  assert.deepEqual(brief.invalidApiDataModels, []);
  assert.match(brief.frontendTargets?.routes.map((target) => target.summary).join("\n") ?? "", /Route or view for user story/);
  assert.match(brief.frontendTargets?.components.map((target) => target.summary).join("\n") ?? "", /Filter table wireframe/);
  assert.match(brief.frontendTargets?.dataNeeds.map((target) => target.summary).join("\n") ?? "", /Integrate GET \/filters/);
  assert.match(brief.frontendTargets?.dataNeeds.map((target) => target.summary).join("\n") ?? "", /Use data model filter with fields id, label/);
  assert.match(brief.frontendTargets?.uiStates.map((target) => target.summary).join("\n") ?? "", /Desktop and mobile responsive table/);
  assert.match(brief.frontendTargets?.uiStates.map((target) => target.summary).join("\n") ?? "", /Represent API failure state/);
  assert.deepEqual(brief.userStories, ["As a user, I want saved filters so that I can return to focused views."]);
  assert.deepEqual(brief.constraints, ["Must support offline fallback data."]);
  assert.deepEqual(brief.acceptanceCriteria, ["Filters persist after refresh."]);
  assert.match(brief.deliveryRisks.map((risk) => risk.summary).join("\n"), /Referenced UI design asset was not found/);
  assert.match(brief.deliveryRisks.map((risk) => risk.summary).join("\n"), /authentication or authorization/);
  assert.deepEqual(brief.recommendedVerification, ["npm run check"]);
});

test("assessDeliveryRisks scores ambiguous requirements and missing delivery gates", () => {
  const risks = assessDeliveryRisks(
    {
      requirementsPath: "docs/requirements.md",
      requirements: [
        "# Requirements",
        "",
        "- [ ] TODO confirm checkout error states.",
        "- Maybe add bulk actions later.",
        "- The UI should feel fast and intuitive."
      ].join("\n"),
      uiPath: "docs/ui.md",
      ui: "# UI Notes\n\n- Checkout table.",
      apiPath: "docs/api.md",
      api: "# API Docs\n\n```json\n{bad json}\n```"
    },
    {
      packageManager: "npm",
      runtimes: ["Node.js"],
      frameworks: [],
      buildTools: [],
      styling: [],
      testing: [],
      scripts: {},
      sourceDirectories: [],
      configFiles: [],
      notes: []
    }
  );

  assert.ok(risks.some((risk) => risk.level === "high" && /TODO confirm/.test(risk.summary)));
  assert.ok(risks.some((risk) => risk.level === "medium" && /tentative scope/.test(risk.summary)));
  assert.ok(risks.some((risk) => risk.level === "medium" && /subjective quality/.test(risk.summary)));
  assert.ok(risks.some((risk) => risk.level === "high" && /No frontend framework/.test(risk.summary)));
  assert.ok(risks.some((risk) => risk.level === "high" && /No runnable verification/.test(risk.summary)));
  assert.ok(risks.some((risk) => risk.level === "high" && /invalid data model/.test(risk.summary)));
});

test("extractUiStateChecklist captures structured UI states and keyword-driven checks", () => {
  assert.deepEqual(
    extractUiStateChecklist(
      [
        "# UI Notes",
        "",
        "## Screens",
        "- Checkout dashboard with order summary.",
        "",
        "## Components",
        "- Status pill with icon and label.",
        "",
        "## States",
        "- Loading: show skeleton rows.",
        "- Empty: show a helpful recovery message.",
        "- Error: show retry action.",
        "",
        "## Interactions",
        "- Search filters update the table.",
        "",
        "## Responsive Behavior",
        "- Mobile stacks filters above results.",
        "",
        "## Accessibility",
        "- Keyboard focus stays visible on primary actions.",
        "",
        "## Misc",
        "- Disabled submit button explains missing fields."
      ].join("\n")
    ),
    [
      {
        kind: "screen",
        sourceLine: 4,
        summary: "Checkout dashboard with order summary."
      },
      {
        kind: "component",
        sourceLine: 7,
        summary: "Status pill with icon and label."
      },
      {
        kind: "state",
        sourceLine: 10,
        summary: "Loading: show skeleton rows."
      },
      {
        kind: "state",
        sourceLine: 11,
        summary: "Empty: show a helpful recovery message."
      },
      {
        kind: "state",
        sourceLine: 12,
        summary: "Error: show retry action."
      },
      {
        kind: "interaction",
        sourceLine: 15,
        summary: "Search filters update the table."
      },
      {
        kind: "responsive",
        sourceLine: 18,
        summary: "Mobile stacks filters above results."
      },
      {
        kind: "accessibility",
        sourceLine: 21,
        summary: "Keyboard focus stays visible on primary actions."
      },
      {
        kind: "interaction",
        sourceLine: 24,
        summary: "Disabled submit button explains missing fields."
      }
    ]
  );
});

test("extractApiErrorCases captures error sections and failure keywords", () => {
  assert.deepEqual(
    extractApiErrorCases(
      [
        "# API",
        "",
        "## Error Cases",
        "- Orders endpoint unavailable: show stale data.",
        "- Partial response: flag missing totals.",
        "",
        "Outside section but timeout should be handled."
      ].join("\n")
    ),
    [
      {
        sourceLine: 4,
        summary: "Orders endpoint unavailable: show stale data."
      },
      {
        sourceLine: 5,
        summary: "Partial response: flag missing totals."
      },
      {
        sourceLine: 7,
        summary: "Outside section but timeout should be handled."
      }
    ]
  );
});

test("extractApiAuthRequirements captures auth sections and token keywords", () => {
  assert.deepEqual(
    extractApiAuthRequirements(
      [
        "# API",
        "",
        "## Authentication",
        "- Authorization: Bearer token is required.",
        "- Session cookie expires after 15 minutes.",
        "",
        "Requests include an API key header."
      ].join("\n")
    ),
    [
      {
        sourceLine: 4,
        summary: "Authorization: Bearer token is required."
      },
      {
        sourceLine: 5,
        summary: "Session cookie expires after 15 minutes."
      },
      {
        sourceLine: 7,
        summary: "Requests include an API key header."
      }
    ]
  );
});

test("extractApiDataModels summarizes valid and invalid json code fences", () => {
  const result = extractApiDataModels(
    [
      "```json",
      "{\"order\":{\"id\":\"ord_1\",\"total\":42}}",
      "```",
      "",
      "```json",
      "{bad json}",
      "```"
    ].join("\n")
  );

  assert.deepEqual(result.models, [
    {
      name: "order",
      sourceLine: 1,
      fields: ["id", "total"],
      summary: "order object"
    }
  ]);
  assert.equal(result.invalid.length, 1);
  assert.equal(result.invalid[0]?.sourceLine, 5);
  assert.match(result.invalid[0]?.error ?? "", /JSON|property|token/i);
});

test("extractApiDataModels summarizes OpenAPI component and operation schemas", () => {
  const result = extractApiDataModels(
    [
      "```json",
      JSON.stringify({
        openapi: "3.1.0",
        paths: {
          "/orders": {
            get: {
              responses: {
                "200": {
                  description: "OK",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          orders: { type: "array" },
                          total: { type: "number" }
                        }
                      }
                    }
                  }
                }
              }
            },
            post: {
              requestBody: {
                content: {
                  "application/json": {
                    schema: {
                      $ref: "#/components/schemas/CreateOrderRequest"
                    }
                  }
                }
              },
              responses: {
                "201": {
                  description: "Created",
                  content: {
                    "application/json": {
                      schema: {
                        $ref: "#/components/schemas/Order"
                      }
                    }
                  }
                }
              }
            }
          }
        },
        components: {
          schemas: {
            Order: {
              type: "object",
              properties: {
                id: { type: "string" },
                status: { type: "string" }
              }
            },
            CreateOrderRequest: {
              type: "object",
              properties: {
                status: { type: "string" }
              }
            }
          }
        }
      }),
      "```"
    ].join("\n")
  );

  assert.deepEqual(result.invalid, []);
  assert.deepEqual(result.models, [
    {
      name: "Order",
      sourceLine: 1,
      fields: ["id", "status"],
      summary: "OpenAPI component schema"
    },
    {
      name: "CreateOrderRequest",
      sourceLine: 1,
      fields: ["status"],
      summary: "OpenAPI component schema"
    },
    {
      name: "GET /orders 200 response",
      sourceLine: 1,
      fields: ["orders", "total"],
      summary: "OpenAPI response schema (application/json)"
    },
    {
      name: "POST /orders request",
      sourceLine: 1,
      fields: ["$ref: CreateOrderRequest"],
      summary: "OpenAPI request schema (application/json)"
    },
    {
      name: "POST /orders 201 response",
      sourceLine: 1,
      fields: ["$ref: Order"],
      summary: "OpenAPI response schema (application/json)"
    }
  ]);
});

test("extractApiContracts handles common HTTP endpoint lines and removes duplicates", () => {
  assert.deepEqual(
    extractApiContracts(
      [
        "## Endpoints",
        "- `GET /orders?status=open`",
        "- POST /orders",
        "- PATCH /orders/{id} updates an order",
        "- GET /orders?status=open"
      ].join("\n")
    ),
    [
      {
        method: "GET",
        path: "/orders?status=open",
        sourceLine: 2,
        summary: "GET /orders?status=open"
      },
      {
        method: "POST",
        path: "/orders",
        sourceLine: 3,
        summary: "POST /orders"
      },
      {
        method: "PATCH",
        path: "/orders/{id}",
        sourceLine: 4,
        summary: "PATCH /orders/{id} updates an order"
      }
    ]
  );
});

test("extractApiContracts handles OpenAPI JSON paths", () => {
  const openApiMarkdown = [
    "# API",
    "",
    "```json",
    JSON.stringify({
      openapi: "3.1.0",
      paths: {
        "/orders": {
          get: {
            summary: "List orders",
            security: [{ bearerAuth: [] }],
            responses: {
              "200": { description: "OK" },
              "401": { description: "Unauthorized" },
              "500": { description: "Service unavailable" }
            }
          },
          post: {
            description: "Create an order",
            responses: {
              "201": { description: "Created" },
              default: { description: "Unexpected error" }
            }
          }
        }
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT"
          }
        }
      }
    }),
    "```"
  ].join("\n");

  assert.deepEqual(extractApiContracts(openApiMarkdown), [
    {
      method: "GET",
      path: "/orders",
      sourceLine: 3,
      summary: "List orders"
    },
    {
      method: "POST",
      path: "/orders",
      sourceLine: 3,
      summary: "Create an order"
    }
  ]);
  assert.deepEqual(extractApiErrorCases(openApiMarkdown), [
    {
      sourceLine: 3,
      summary: "GET /orders 401: Unauthorized"
    },
    {
      sourceLine: 3,
      summary: "GET /orders 500: Service unavailable"
    },
    {
      sourceLine: 3,
      summary: "POST /orders default: Unexpected error"
    }
  ]);
  assert.deepEqual(extractApiAuthRequirements(openApiMarkdown), [
    {
      sourceLine: 3,
      summary: "OpenAPI security scheme bearerAuth: http bearer JWT"
    },
    {
      sourceLine: 3,
      summary: "OpenAPI GET /orders security requirement: bearerAuth"
    }
  ]);
});

test("extractApiContracts and API summaries handle OpenAPI YAML blocks", () => {
  const openApiMarkdown = [
    "# API",
    "",
    "```yaml",
    "openapi: 3.1.0",
    "security:",
    "  - bearerAuth: []",
    "paths:",
    "  /orders:",
    "    get:",
    "      summary: List orders",
    "      security:",
    "        - bearerAuth: []",
    "      responses:",
    "        '200':",
    "          description: OK",
    "          content:",
    "            application/json:",
    "              schema:",
    "                type: object",
    "                properties:",
    "                  orders:",
    "                    type: array",
    "                  total:",
    "                    type: number",
    "        '401':",
    "          description: Unauthorized",
    "    post:",
    "      description: Create an order",
    "      requestBody:",
    "        content:",
    "          application/json:",
    "            schema:",
    "              $ref: '#/components/schemas/CreateOrderRequest'",
    "      responses:",
    "        '201':",
    "          description: Created",
    "          content:",
    "            application/json:",
    "              schema:",
    "                $ref: '#/components/schemas/Order'",
    "        default:",
    "          description: Unexpected error",
    "components:",
    "  schemas:",
    "    Order:",
    "      type: object",
    "      properties:",
    "        id:",
    "          type: string",
    "        status:",
    "          type: string",
    "    CreateOrderRequest:",
    "      type: object",
    "      properties:",
    "        status:",
    "          type: string",
    "  securitySchemes:",
    "    bearerAuth:",
    "      type: http",
    "      scheme: bearer",
    "      bearerFormat: JWT",
    "```"
  ].join("\n");

  assert.deepEqual(extractApiContracts(openApiMarkdown), [
    {
      method: "GET",
      path: "/orders",
      sourceLine: 3,
      summary: "List orders"
    },
    {
      method: "POST",
      path: "/orders",
      sourceLine: 3,
      summary: "Create an order"
    }
  ]);
  assert.deepEqual(extractApiDataModels(openApiMarkdown), {
    invalid: [],
    models: [
      {
        name: "Order",
        sourceLine: 3,
        fields: ["id", "status"],
        summary: "OpenAPI component schema"
      },
      {
        name: "CreateOrderRequest",
        sourceLine: 3,
        fields: ["status"],
        summary: "OpenAPI component schema"
      },
      {
        name: "GET /orders 200 response",
        sourceLine: 3,
        fields: ["orders", "total"],
        summary: "OpenAPI response schema (application/json)"
      },
      {
        name: "POST /orders request",
        sourceLine: 3,
        fields: ["$ref: CreateOrderRequest"],
        summary: "OpenAPI request schema (application/json)"
      },
      {
        name: "POST /orders 201 response",
        sourceLine: 3,
        fields: ["$ref: Order"],
        summary: "OpenAPI response schema (application/json)"
      }
    ]
  });
  assert.deepEqual(extractApiErrorCases(openApiMarkdown), [
    {
      sourceLine: 3,
      summary: "GET /orders 401: Unauthorized"
    },
    {
      sourceLine: 3,
      summary: "POST /orders default: Unexpected error"
    }
  ]);
  assert.deepEqual(extractApiAuthRequirements(openApiMarkdown), [
    {
      sourceLine: 3,
      summary: "OpenAPI security scheme bearerAuth: http bearer JWT"
    },
    {
      sourceLine: 3,
      summary: "OpenAPI global security requirement: bearerAuth"
    },
    {
      sourceLine: 3,
      summary: "OpenAPI GET /orders security requirement: bearerAuth"
    }
  ]);
});

test("extractApiContracts handles yml OpenAPI fences", () => {
  assert.deepEqual(
    extractApiContracts(
      [
        "```yml",
        "openapi: 3.1.0",
        "paths:",
        "  /health:",
        "    get:",
        "      summary: Health check",
        "      responses:",
        "        '200':",
        "          description: OK",
        "```"
      ].join("\n")
    ),
    [
      {
        method: "GET",
        path: "/health",
        sourceLine: 1,
        summary: "Health check"
      }
    ]
  );
});

test("extractApiDataModels reports invalid OpenAPI YAML and ignores ordinary YAML", () => {
  const result = extractApiDataModels(
    [
      "```yaml",
      "openapi: 3.1.0",
      "paths:",
      "  /orders:",
      "    get: [",
      "```",
      "",
      "```yaml",
      "example: [",
      "```"
    ].join("\n")
  );

  assert.deepEqual(result.models, []);
  assert.equal(result.invalid.length, 1);
  assert.equal(result.invalid[0]?.sourceLine, 1);
  assert.match(result.invalid[0]?.error ?? "", /YAML|flow|sequence|unexpected|unexpected/i);
});

test("extractDesignAssets handles local, remote, and titled markdown image references", () => {
  assert.deepEqual(
    extractDesignAssets(
      [
        "![Local](assets/dashboard.png \"Dashboard\")",
        "![Remote](https://example.com/mock.png)",
        "![Angled](<assets/mobile mock.png>)"
      ].join("\n"),
      "docs/ui.md"
    ),
    [
      {
        source: "ui-markdown-image",
        kind: "local",
        altText: "Local",
        reference: "assets/dashboard.png",
        resolvedPath: "docs/assets/dashboard.png",
        exists: false
      },
      {
        source: "ui-markdown-image",
        kind: "remote",
        altText: "Remote",
        reference: "https://example.com/mock.png"
      },
      {
        source: "ui-markdown-image",
        kind: "local",
        altText: "Angled",
        reference: "assets/mobile mock.png",
        resolvedPath: "docs/assets/mobile mock.png",
        exists: false
      }
    ]
  );
});

test("extractDesignAssets reads metadata from local svg design assets", (t) => {
  const workspace = mkdtempSync(join(tmpdir(), "dev-flow-brief-"));
  const docsDir = join(workspace, "docs");
  const assetsDir = join(docsDir, "assets");
  const svgPath = join(assetsDir, "dashboard.svg");

  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  mkdirSync(assetsDir, { recursive: true });
  writeFileSync(
    svgPath,
    [
      '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768" fill="#F8FAFC">',
      "  <title>Dashboard &amp; status</title>",
      "  <desc>Wireframe with key panels.</desc>",
      '  <rect width="1024" height="768" stroke="rgb(34,197,94)" />',
      '  <path style="fill: var(--accent); stroke: none" />',
      "  <text fill=\"#0F172A\">Release health</text>",
      "  <text><tspan>Checkout</tspan> &amp; Identity</text>",
      "  <text>Deploy ready</text>",
      "</svg>"
    ].join("\n"),
    "utf8"
  );

  assert.deepEqual(extractDesignAssets("![Dashboard SVG](assets/dashboard.svg)", join(docsDir, "ui.md")), [
    {
      source: "ui-markdown-image",
      kind: "local",
      altText: "Dashboard SVG",
      reference: "assets/dashboard.svg",
      resolvedPath: svgPath,
      exists: true,
      metadata: {
        width: "1024",
        height: "768",
        viewBox: "0 0 1024 768",
        title: "Dashboard & status",
        description: "Wireframe with key panels.",
        colors: ["#f8fafc", "rgb(34, 197, 94)", "#0f172a", "var(--accent)"],
        textSnippets: ["Release health", "Checkout & Identity", "Deploy ready"]
      }
    }
  ]);
});

test("extractDesignAssets reads dimensions from local png and jpeg design assets", (t) => {
  const workspace = mkdtempSync(join(tmpdir(), "dev-flow-brief-"));
  const docsDir = join(workspace, "docs");
  const assetsDir = join(docsDir, "assets");
  const pngPath = join(assetsDir, "desktop.png");
  const jpegPath = join(assetsDir, "mobile.jpg");

  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  mkdirSync(assetsDir, { recursive: true });
  writeFileSync(pngPath, createPngHeader(1440, 900));
  writeFileSync(jpegPath, createJpegHeader(390, 844));

  assert.deepEqual(
    extractDesignAssets(
      [
        "![Desktop comp](assets/desktop.png)",
        "![Mobile comp](assets/mobile.jpg)"
      ].join("\n"),
      join(docsDir, "ui.md")
    ),
    [
      {
        source: "ui-markdown-image",
        kind: "local",
        altText: "Desktop comp",
        reference: "assets/desktop.png",
        resolvedPath: pngPath,
        exists: true,
        metadata: {
          width: "1440",
          height: "900"
        }
      },
      {
        source: "ui-markdown-image",
        kind: "local",
        altText: "Mobile comp",
        reference: "assets/mobile.jpg",
        resolvedPath: jpegPath,
        exists: true,
        metadata: {
          width: "390",
          height: "844"
        }
      }
    ]
  );
});

function createPngHeader(width: number, height: number): Buffer {
  const bytes = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes, 0);
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);

  return bytes;
}

function createJpegHeader(width: number, height: number): Buffer {
  const bytes = Buffer.alloc(27);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  bytes[3] = 0xe0;
  bytes.writeUInt16BE(4, 4);
  bytes[8] = 0xff;
  bytes[9] = 0xc0;
  bytes.writeUInt16BE(17, 10);
  bytes[12] = 8;
  bytes.writeUInt16BE(height, 13);
  bytes.writeUInt16BE(width, 15);

  return bytes;
}
