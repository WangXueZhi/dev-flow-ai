# Requirements

OpsBoard should give release managers and frontend platform engineers a single operational view of deployment readiness, service health, and incident pressure.

## Goal

Build a dashboard that helps a release owner decide whether the next production deployment is safe to continue.

## User Stories

- As a release owner, I want to see deployment readiness across environments so that I can spot blocked stages quickly.
- As a platform engineer, I want to compare service health and API latency so that I can prioritize risky services.
- As an incident commander, I want open incidents visible beside deployment activity so that release decisions reflect current operational pressure.
- As a team lead, I want ownership and next action labels so that unresolved work has a clear handoff.

## Acceptance Criteria

- [ ] The first viewport shows release health, deploy confidence, API latency, and incident pressure.
- [ ] The deployment table includes service, owner, environment, status, build, and next action.
- [ ] The interface includes loading-neutral static states that can later connect to API data.
- [ ] The dashboard is usable at desktop and tablet widths without overlapping text.
- [ ] Risk states use distinct visual treatment for healthy, warning, blocked, and incident conditions.
- [ ] The app builds with `npm run build`.

## Constraints

- Use React and Vite.
- Use local static data for the example.
- Keep the UI operational and dense rather than promotional.
- Avoid requiring authentication for the example.
