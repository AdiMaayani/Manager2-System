# ManageR² System

Production monorepo for the ManageR² operations platform.

## Structure

```
ManageR2-System/
  apps/
    web/     # React + Vite + TypeScript SPA
    api/     # ASP.NET Core 8 backend
  database/SP/   # SQL stored procedures
```

## Prerequisites

- Node.js 20+
- .NET 8 SDK
- SQL Server (for API data in `local` mode)

## Run locally (end-to-end)

**Terminal 1 — API**

```bash
cd apps/api
dotnet run --project ManageR2.Api
```

API listens on `http://localhost:5162` (5161 is reserved for the legacy UI reference stack in `_temp/dev-ui`).

**Terminal 2 — Web**

```bash
# from repo root
npm install
npm run dev
```

SPA runs on `http://localhost:5173`. Vite proxies `/api` to the backend.

## Legacy UI reference (read-only)

The vanilla HTML UI from the `dev` branch lives in `_temp/dev-ui/` (gitignored clone). **Do not edit it** — use it only for side-by-side comparison while building the React app.

**Terminal A — legacy API (port 5161)**

```bash
cd _temp/dev-ui/backend
dotnet run --project ManageR2.Api
```

**Terminal B — legacy static UI (port 5500, same layout as VS Code Live Server on `dev`)**

```bash
npm run dev:legacy:ui
```

Open **`http://localhost:5500/frontend/pages/login.html`**.

Sidebar links resolve under `/frontend/pages/` (e.g. workplan → `/frontend/pages/workplan.html`). The legacy frontend calls `http://localhost:5161/api`.

Or run both legacy processes:

```bash
npm run dev:legacy:api   # port 5161
npm run dev:legacy:ui    # port 5500
```

## Data modes

Configure in `apps/web/.env.development`:

| `VITE_APP_DATA_MODE` | Behavior |
|----------------------|----------|
| `local` | Real API via `apiRequest` (default) |
| `mock` | In-memory mock data — no API required |

Copy `apps/web/.env.example` to `.env.development` and adjust.

For UI-only work without SQL/API:

```
VITE_APP_DATA_MODE=mock
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (`apps/web`) |
| `npm run dev:api` | Start new API on port 5162 |
| `npm run dev:legacy:api` | Start legacy reference API on port 5161 |
| `npm run dev:legacy:ui` | Serve legacy HTML UI on port 5500 |
| `npm run build` | Production build of web app |
| `dotnet build apps/api/ManageR2.Backend.sln` | Build backend |

## Routes (React)

| Path | Module |
|------|--------|
| `/login` | Auth |
| `/` | Dashboard |
| `/workplan` | Work plan + Gantt |
| `/projects` | Projects |
| `/reports` | Reports |
| `/employees` | Users / employees |
| `/contacts` | Contacts |
| `/customers` | Customers |
| `/quotes` | Quotes (mock when no API) |
| `/inventory` | Inventory (mock) |
| `/service-calls` | Service calls (mock) |
| `/cashflow` | Cashflow (mock) |
| `/settings` | Settings |
