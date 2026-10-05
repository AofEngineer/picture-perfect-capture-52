# Development baseline

Imported on 3 October 2026 from `AofEngineer/picture-perfect-capture-52`, branch `main`, commit `ec2b2d01f737fbc2c716ffc75704679b742ec7c6`.

## Design and requirements

The existing Lovable UI is the design reference: BMW-inspired colors, a dark sidebar, white panels, blue actions, compact radii, and IBM Plex Sans Thai typography. Preserve the existing layout, assets, and reusable components when developing further.

The complete user-supplied requirements are preserved verbatim in `lovable-original-prompt.txt`. They describe the intended prototype, rather than functionality already completed in this repository.

## Imported implementation (before continuation)

- App shell with navigation, branch selection, Demo Role Switcher, notification popover, and Reset Demo Data.
- Dashboard with KPIs, today's/tomorrow's tasks, weekly list/calendar, task details, and workflow bottlenecks.
- Booking list with search, filters, sorting, pagination, CSV export, and a creation form.
- Booking detail tabs for overview, OCR/AMLO simulation, payments/Loyalty, workflow/tasks, signatures/documents/delivery, refunds, and activity history.
- Shared demo state persisted in local storage; mock entities and roles; audit recording through the store.

## Initially missing routes (now implemented)

At import, only `/`, `/bookings`, and `/bookings/$id` had route components. The following linked routes have since been implemented:

- `/customers`, `/customers/$id`
- `/stock`, `/stock/$id`, `/stock/check`, `/stock/operations`, `/stock/service-orders`, `/stock/red-plates`
- `/sales`, `/sales/commission`
- `/bookings/refunds`
- `/admin/reports`, `/admin/integrations`, `/admin/loyalty`, `/admin/access`, `/admin/audit`, `/admin/notifications`
- `/inbox`

Mock data for these modules already exists. Reuse the shared IDs and store when adding their screens. Each existing workflow also needs functional verification against the original requirements; a present tab does not establish complete coverage.

## Local development

Node.js is available. Dependencies were installed with Bun against the existing `bun.lock`, without changing package versions or adding a second lockfile:

```powershell
npm.cmd exec --yes --package=bun -- bun install --frozen-lockfile
npm.cmd run dev -- --host 127.0.0.1 --port 3000
```

Open `http://127.0.0.1:3000/`. The existing build configuration targets Cloudflare through the Lovable Vite configuration; no deployment was performed.

## Initial validation

- `npm.cmd run build`: passed.
- `npm.cmd test`: both existing routing smoke tests failed. React 19's document shell renders outside the default test `div`, leaving `container.firstChild` empty. The test harness needs to be aligned with the full-document root layout and should verify visible route content.
- `node node_modules/typescript/bin/tsc --noEmit`: failed with 125 diagnostics. These include references to missing routes, strict optional/array/index access errors, and existing component typings. The Vite build does not run TypeScript validation.
- `npm.cmd run lint`: failed with 7,300 errors and eight warnings on the untouched import. Most are formatting violations, including Git checkout CRLF line endings; one error is `@typescript-eslint/no-unused-expressions`.
- Browser verification: Dashboard and Booking list render, and sidebar navigation between them works. Booking displays 13 demo records with pagination. This does not verify every booking action or the missing modules.

These are findings from the imported code, not passing acceptance checks. Avoid broad formatting or redesign changes during feature work; address relevant errors alongside the feature being implemented.

## Original implementation sequence

1. Add Customer and Stock list/detail routes to support links already used by Booking.
2. Add Stock operations, Service Orders, and Red Plate Management to complete delivery prerequisites.
3. Add Sales and Commission to complete the sales demonstration.
4. Add refund overview, administration, and Notification Center routes.
5. Verify permissions, cross-module updates, duplicate-action prevention, and the complete demonstration scenarios from the original prompt.

## Continuation delivered on 3 October 2026

- Added all initially missing sidebar destinations, plus a Sales detail page. Customer, Inventory, Sales, and workflow pages share the existing store and Lovable UI components.
- Added receive/transfer stock operations with destination receipt, VIN validation, cancellation before dispatch, and a simulated stock import that skips duplicate VINs without overwriting user edits.
- Added Service Orders with scheduling, assignees, item notes, completion checks, and connected Dashboard tasks; Red Plate master creation/editing, matching, unmatching, physical return, transfers, loss reporting, registration, and return follow-ups.
- Added Sales summaries and Commission breakdowns, claim numbers, role-dependent approvals, rejection history, payment recording, CSV export, and print previews.
- Added refund overview and A–E paths, cash/point return, payment evidence, responsible branch, and a separate vehicle release approval. Financial commands reject duplicates and invalid state transitions.
- Added integrations/logs/mapping, Loyalty mismatch tracking and transaction retry, formula simulation/draft/approval, Access Control, read-only Audit Log, Reports, Notification Center, and evaluation of all six seeded notification rules with recipients and frequency.
- Corrected synchronous store mutations, scope-aware navigation/search, strict TypeScript typings, point-value snapshots, payment limits, pending Burn protection, OCR result persistence, document escaping, and local appointment times. Original styles, assets, dependencies, and package lock are preserved.

### Current validation

- `npm.cmd run build`: passed.
- `node node_modules/typescript/bin/tsc --noEmit`: passed.
- `npm.cmd test`: 40 tests passed, including all added destinations, entity detail routes, scope protection, and connected workflow commands.
- ESLint on changed/new TypeScript files: zero errors; five component-export Fast Refresh warnings. Repository-wide lint still includes the untouched import's formatting debt.
- Browser: verified Customer/Stock/Service/Sales navigation; confirmed incomplete Service checklist blocks completion; processed CM-02 through submission, manager review, finance approval, and paid state; verified Sales role hides Administration and other salespeople's commissions. Checked Desktop 1440×900 and Tablet 1024×768.

### Prototype boundaries

The app continues to use local-storage demo state, a Demo Role Switcher, and simulated external integrations. Permissions are prototype UI behavior, not production authentication. Print/PDF uses the browser print dialog and Save as PDF. Mapping fields are saved for demonstration; there is no live ETL pipeline. Stock import and Loyalty sync mutate mock records, while the other connection checks and ERP import remain illustrative. Notification evaluation is manually triggered in the prototype rather than a background scheduler. No deployment or GitHub push has been performed.

Use `docs/demo-walkthrough.md` for the connected demonstration sequence. Reset Demo Data generates dates relative to the day it is clicked; existing saved demo data retains its dates.

## OCR and AI Assistant delivered on 4 October 2026

- Expanded Booking's OCR panel to identity cards, house registrations, and payment evidence; added local file selection/preview, sample scenarios, confidence per field, manual review, validation, recorded reviewers, and confirmed document history.
- Identity confirmation remains separate from other document types. Payment evidence confirmation does not record a payment. Expired/mismatched/invalid results block confirmation, and low-confidence fields require review.
- Added an AI Assistant drawer throughout the app with scoped summaries, Booking context, linked records, quick questions, loading/error/retry, cancellation, and conversation reset when access changes.
- Added typed OCR/Chat provider contracts, ephemeral file input, and a context allowlist. Both providers remain deterministic demos with no external API calls; uploaded content is not read by the demo.
- Validation: production build and TypeScript passed; 56 tests passed; ESLint on this feature's files has zero errors and one existing AppShell Fast Refresh warning. Browser verified expired-card blocking, low-confidence review/confirmation, scoped linked answers, current Booking context, and Desktop/Tablet layouts.

See `docs/ai-demo.md` for usage and the future server/API adapter contract. Original theme assets, dependency versions, and lockfile are unchanged.
