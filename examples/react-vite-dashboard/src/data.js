export const metrics = [
  {
    label: "Release health",
    value: "86",
    suffix: "/100",
    trend: "+4 from last window",
    tone: "good"
  },
  {
    label: "Deploy confidence",
    value: "Guarded",
    suffix: "",
    trend: "1 blocker in checkout",
    tone: "warn"
  },
  {
    label: "API p95 latency",
    value: "184",
    suffix: "ms",
    trend: "12ms over budget",
    tone: "risk"
  },
  {
    label: "Incident pressure",
    value: "3",
    suffix: "open",
    trend: "2 customer-facing",
    tone: "hot"
  }
];

export const deployments = [
  {
    service: "Checkout Gateway",
    owner: "Payments",
    environment: "Production",
    status: "Blocked",
    build: "2026.06.23-rc.4",
    nextAction: "Resolve contract drift"
  },
  {
    service: "Identity Session",
    owner: "Core Auth",
    environment: "Canary",
    status: "In progress",
    build: "2026.06.23-rc.2",
    nextAction: "Watch p95 for 20m"
  },
  {
    service: "Inventory Edge",
    owner: "Supply",
    environment: "Staging",
    status: "Healthy",
    build: "2026.06.23-rc.7",
    nextAction: "Promote after smoke"
  },
  {
    service: "Pricing Rules",
    owner: "Commerce",
    environment: "Production",
    status: "Warning",
    build: "2026.06.23-rc.1",
    nextAction: "Confirm rollback plan"
  },
  {
    service: "Notification Fanout",
    owner: "Messaging",
    environment: "Staging",
    status: "Healthy",
    build: "2026.06.23-rc.6",
    nextAction: "Ready for deploy"
  }
];

export const incidents = [
  {
    severity: "SEV-2",
    service: "Checkout Gateway",
    owner: "Payments",
    age: "42m",
    detail: "Contract mismatch on tax estimate response"
  },
  {
    severity: "SEV-3",
    service: "Pricing Rules",
    owner: "Commerce",
    age: "1h 18m",
    detail: "Promotion cache misses above baseline"
  },
  {
    severity: "SEV-3",
    service: "Identity Session",
    owner: "Core Auth",
    age: "2h 04m",
    detail: "Canary refresh-token retries elevated"
  }
];

export const services = [
  { name: "Checkout", health: 71, latency: 236, errors: "0.42%", tone: "hot" },
  { name: "Identity", health: 82, latency: 181, errors: "0.18%", tone: "warn" },
  { name: "Inventory", health: 94, latency: 92, errors: "0.04%", tone: "good" },
  { name: "Pricing", health: 78, latency: 164, errors: "0.22%", tone: "risk" },
  { name: "Messaging", health: 91, latency: 118, errors: "0.08%", tone: "good" }
];

export const contracts = [
  { endpoint: "GET /api/release/summary", schema: "stable", owner: "Platform" },
  { endpoint: "GET /api/release/deployments", schema: "stable", owner: "Release" },
  { endpoint: "GET /api/release/incidents", schema: "watch", owner: "SRE" },
  { endpoint: "GET /api/release/contracts", schema: "drift", owner: "Platform" }
];
