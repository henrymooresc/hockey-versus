# Hockey Versus

Compare how NHL players perform when sharing the ice. Covers the last 10 NHL seasons.

## Tech Stack

- **Frontend:** Next.js 16, React 19, Tailwind CSS
- **Database:** PostgreSQL + Drizzle ORM
- **Data Source:** NHL APIs (`web-api.nhle.com`, `api.nhle.com`)
- **Language:** TypeScript

## Setup

```bash
npm install
cp .env.example .env   # set DATABASE_URL
npx drizzle-kit migrate
```

## Data Ingestion

Run in order:

```bash
npm run ingest:seasons   # games & teams
npm run ingest:players   # player info
npm run ingest:shifts    # shift chart data
npm run ingest:events    # play-by-play events
npm run compute:versus   # head-to-head stats
```

## Development

```bash
npm run dev
```
