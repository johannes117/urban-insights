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

## Project Structure

```
src/
├── routes/          # File-based routes (__root.tsx, index.tsx, etc.)
├── components/      # React components
├── router.tsx       # Router configuration
└── routeTree.gen.ts # Auto-generated route tree (do not edit)
```

## Routing

Routes are defined in `src/routes/`. The route tree is auto-generated on dev server start.

- `__root.tsx` - Root layout wrapping all routes
- `index.tsx` - Home route (/)
- `about.tsx` - Creates /about route
- `posts/` directory - Creates nested /posts/* routes

## @json-render/react

Used for rendering dynamic UI from JSON definitions.

- `useData()` returns `{ data, authState, get, set, update }` - destructure `data` to access the actual data
- Components must be wrapped in `DataProvider`, `VisibilityProvider`, and `ActionProvider`
- Custom components receive an `element` prop with `element.props` containing the component's properties
