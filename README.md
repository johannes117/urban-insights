# Urban Insights

A web application developed by TP6 Team 1 that synthesises urban liveability data to help local governments and organisations prioritise sustainable development efforts.

The application was developed in support of UN Sustainable Development Goal 11: [Sustainable Cities and Communities](https://www.un.org/sustainabledevelopment/cities/). Initial datasets focus on Victoria, Australia, but the architecture allows for easy translation to other regions and data sources.

## Getting Started

After populating `.env` (see below), run:

```bash
bun install
bun run dev
```

The app will be available at <http://localhost:3000>. Datasets can be managed at <http://localhost:3000/admin>.

## Environment Variables

Create a `.env` file with, at a minimum:

```env
DATABASE_URL=your_neon_postgres_url
ANTHROPIC_API_KEY=your_anthropic_key
```

Refer to `.env.example` for alternative providers and other relevant fields.

## Scripts

| Command | Description |
| ------- | ----------- |
| `bun run dev` | Start development server |
| `bun run build` | Build for production |
| `bun run preview` | Preview production build |
| `bun run test` | Run tests |
| `bun run db:generate` | Generate database migrations |
| `bun run db:push` | Push schema to database |
| `bun run db:studio` | Open Drizzle Studio |
| `bun run db:lowercase-datasets` | Lowercase dataset names |

## Database Migrations

To set up the database tables for auth and chat history:

```bash
bun run scripts/migrate.ts
```

## Features

- **AI Chat Interface**: Conversational AI for querying Victorian census and urban data
- **Dynamic Visualizations**: Auto-generated charts, tables, and dashboards
- **Chat History**: Persistent conversations using browser cache
- **LGA Context**: Filter queries by Local Government Area
