# Urban Insights

TanStack Start application with React 19.

## Commands

```bash
bun run dev      # Start dev server on port 3000
bun run build    # Build for production
bun run preview  # Preview production build
bun run test     # Run tests with Vitest
```

## Stack

- TanStack Start + Router (file-based routing)
- React 19
- Vite 7
- TypeScript
- Neon Postgres + Drizzle ORM
- Arctic (Google OAuth)

## Project Structure

```
src/
├── routes/              # File-based routes
│   ├── __root.tsx       # Root layout
│   ├── index.tsx        # Main app (welcome + chat)
│   ├── admin/           # Admin panel for datasets
│   └── auth/callback/   # OAuth callback routes
├── components/
│   ├── ChatPanel.tsx    # Chat messages + input
│   ├── ChatInput.tsx    # Reusable input with LGA selector
│   ├── ArtifactPanel.tsx # Visualization panel
│   ├── WelcomeScreen.tsx # Landing page
│   ├── UserMenu.tsx     # User avatar dropdown
│   ├── ChatHistory.tsx  # Chat history sidebar
│   └── ui/              # UI components for visualizations
├── server/
│   ├── chat.ts          # AI chat server functions
│   ├── auth.ts          # Auth server functions
│   └── chatHistory.ts   # Chat persistence functions
├── lib/
│   ├── auth.ts          # Google OAuth + session management
│   ├── authContext.tsx  # React auth context
│   ├── agent.ts         # LangChain agent setup
│   ├── types.ts         # TypeScript types
│   └── abs/             # ABS census utilities
├── db/
│   ├── index.ts         # Drizzle client
│   └── schema.ts        # Database schema
└── routeTree.gen.ts     # Auto-generated (do not edit)
```

## Database Schema

- `users` - Google OAuth users
- `sessions` - Auth sessions (30-day expiry)
- `chat_sessions` - User chat conversations
- `messages` - Chat messages with UI/tool data
- `datasets` - Uploaded CSV datasets

## Authentication

Uses Arctic for Google OAuth with custom session management:
- Sessions stored in Postgres, 30-day expiry with sliding window
- HttpOnly cookies for session tokens
- Optional auth - app works without signing in

Google OAuth callback: `/auth/callback/google`

## AI Agent

Uses LangChain with Anthropic Claude. Tools:
- `list_datasets` - List available datasets
- `get_dataset_schema` - Get table structure + sample data
- `query_dataset` - Execute SQL SELECT queries
- `render_ui` - Render visualizations

## @json-render/react

Used for rendering dynamic UI from JSON definitions.

- `useData()` returns `{ data, authState, get, set, update }`
- Components wrapped in `DataProvider`, `VisibilityProvider`, `ActionProvider`
- Custom components receive `element` prop with `element.props`

## UI Flow

1. **Welcome Screen** - Centered input with greeting, LGA selector, suggestion badges
2. **Chat View** - Centered chat when no artifact, split view when artifact exists
3. **Artifact Panel** - Hidden until first visualization, then resizable split
