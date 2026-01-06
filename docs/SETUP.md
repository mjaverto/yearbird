# Local Development Setup

## Prerequisites

- Node.js 20+
- npm 10+
- A Google Cloud project (optional, for testing OAuth)

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/mjaverto/yearbird.git
cd yearbird
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the dev server

```bash
npm run dev
```

### 4. Open in browser

Navigate to [http://localhost:5173/yearbird/](http://localhost:5173/yearbird/)

## Project Structure

```
yearbird/
├── src/
│   ├── components/
│   │   ├── ui/              # Catalyst UI components
│   │   ├── calendar/        # Year grid components
│   │   └── ...
│   ├── hooks/               # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useCalendarEvents.ts
│   │   └── useFilters.ts
│   ├── services/            # External API integrations
│   │   ├── auth.ts          # Google OAuth
│   │   ├── calendar.ts      # Google Calendar API
│   │   ├── cache.ts         # localStorage caching
│   │   └── filters.ts       # Event filtering
│   ├── utils/               # Helper functions
│   │   ├── dateUtils.ts
│   │   ├── eventProcessor.ts
│   │   └── categorize.ts
│   ├── config/              # Configuration
│   │   └── categories.ts    # Color categories
│   ├── types/               # TypeScript types
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── docs/                    # Documentation
├── .github/workflows/       # CI/CD
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Environment Variables

For local development with your own Google OAuth:

### 1. Create `.env.local`

```bash
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

### Fixture mode (no auth)

Use fixture data and bypass Google auth (handy for layout and Playwright tests):

```bash
VITE_USE_FIXTURE_EVENTS=true
VITE_FIXED_DATE=2026-01-15
```

Fixture mode only applies in dev/test builds. It is ignored in production builds.

### Optional help link

Override the in-app Help menu target (defaults to the GitHub wiki):

```bash
VITE_HELP_URL=https://github.com/mjaverto/yearbird/wiki
```

To update macOS snapshots on another OS:

```bash
PLAYWRIGHT_SNAPSHOT_PLATFORM=darwin npm run test:e2e:update
```

### 2. Add to `.gitignore`

The `.env.local` file should already be in `.gitignore`. Never commit your client ID.

### 3. Configure OAuth

See [GOOGLE_OAUTH.md](./GOOGLE_OAUTH.md) for detailed setup instructions.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run test` | Run tests |
| `npm run test:e2e` | Run Playwright layout tests |
| `npm run test:e2e:update` | Update Playwright snapshots |
| `npm run lint` | Run ESLint |

## Troubleshooting

### Port already in use

```bash
# Kill process on port 5173
lsof -ti:5173 | xargs kill
```

### OAuth not working locally

- Ensure `http://localhost:5173` is in your authorized JavaScript origins
- Check browser console for CORS errors
- Verify your Client ID is correct in `.env.local`

### Styles not loading

- Make sure Tailwind is installed: `npm install tailwindcss@latest`
- Check that `src/index.css` has `@import "tailwindcss";`

## Next Steps

- [Configure Google OAuth](./GOOGLE_OAUTH.md)
- [Deploy to GitHub Pages](./DEPLOYMENT.md)
- [Understand the architecture](./ARCHITECTURE.md)
