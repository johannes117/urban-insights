# Urban Insights

A web application developed by Team 1 that synthesises urban liveability data to help local governments and organisations prioritise sustainable development efforts, supporting UN Sustainable Development Goal 11: Sustainable Cities and Communities.

## Getting Started

```bash
bun install
bun run dev
npm test
```

The app will be available at http://localhost:3000.

## Environment Variables

Create a `.env` file with:

```env
DATABASE_URL=your_neon_postgres_url
ANTHROPIC_API_KEY=your_anthropic_key

# Google OAuth (optional - for user auth)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start development server |
| `bun run build` | Build for production |
| `bun run preview` | Preview production build |
| `bun run test` | Run tests |
| `bun run db:generate` | Generate database migrations |
| `bun run db:push` | Push schema to database |
| `bun run db:studio` | Open Drizzle Studio |

## Database Migrations

To set up the database tables for auth and chat history:

```bash
bun run scripts/migrate.ts
```

## Features

- **AI Chat Interface**: Conversational AI for querying Victorian census and urban data
- **Dynamic Visualizations**: Auto-generated charts, tables, and dashboards
- **Google Sign-In**: Optional authentication for saving chat history
- **Chat History**: Persistent conversations for signed-in users
- **LGA Context**: Filter queries by Local Government Area
