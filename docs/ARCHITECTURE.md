# Architecture Overview

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Build | Vite | Fast dev server, optimized production builds |
| UI | React 18 | Component-based UI |
| Language | TypeScript | Type safety |
| Styling | Tailwind CSS v4 | Utility-first CSS |
| Components | Catalyst UI Kit | Pre-built accessible components |
| Auth | Google Identity Services | Client-side OAuth |
| API | Google Calendar API v3 | Calendar data |
| Storage | localStorage | Caching and preferences |
| Hosting | GitHub Pages | Static file hosting |

## Key Design Decisions

### Client-Side Only

All logic runs in the browser. There is no backend server.

**Why:**
- **Privacy**: Calendar data never leaves your browser
- **Cost**: Free hosting on GitHub Pages
- **Simplicity**: Easy to fork and deploy
- **Trust**: Users can verify exactly what the code does

**Tradeoffs:**
- OAuth tokens are in browser storage (but scoped to read-only)
- No server-side caching (but we cache in localStorage)

### Full-Screen Layout

The app uses 100% of the viewport to maximize the year view.

```tsx
<div className="h-screen w-screen overflow-hidden">
  <header className="flex-none">...</header>
  <main className="flex-1 overflow-hidden">
    <YearGrid />
  </main>
</div>
```

**Key CSS:**
- `h-screen w-screen` — Fill viewport
- `overflow-hidden` — No scrollbars
- `flex-none` / `flex-1` — Fixed header, flexible main

### localStorage for State

User preferences and cached events are stored in localStorage:

| Key | Contents | TTL |
|-----|----------|-----|
| `yearbird:accessToken` | OAuth access token | Until expiry |
| `yearbird:expiresAt` | Token expiry timestamp | — |
| `yearbird:events:{year}` | Cached calendar events | 24 hours |
| `yearbird:filters` | Hidden event patterns | Permanent |
| `yearbird:disabled-calendars` | Disabled calendars | Permanent |
| `yearbird:disabled-built-in-categories` | Disabled built-in categories | Permanent |
| `yearbird:custom-categories` | User-defined category rules | Permanent |

`yearbird:custom-categories` is stored as `{ version, categories }` for safe migrations.

**Why localStorage:**
- Persists across sessions
- No server needed
- Simple API
- ~5MB storage limit is plenty for calendar data

### Event Filtering Strategy

We only show multi-day and all-day events:

```
Google Calendar Event
        │
        ▼
┌───────────────────┐
│ Is it cancelled?  │──Yes──► Discard
└────────┬──────────┘
         │ No
         ▼
┌───────────────────┐
│ Is it all-day?    │──Yes──► Keep ✓
└────────┬──────────┘
         │ No
         ▼
┌───────────────────┐
│ Spans 2+ days?    │──Yes──► Keep ✓
└────────┬──────────┘
         │ No
         ▼
      Discard
```

### Color Categorization

Events are auto-categorized by keyword matching in titles:

```typescript
// Priority order (first match wins)
const CATEGORIES = [
  { category: 'birthdays', keywords: ['birthday', 'bday'] },
  { category: 'family', keywords: ['family', 'kids', 'mom', 'dad'] },
  { category: 'holidays', keywords: ['flight', 'hotel', 'vacation'] },
  { category: 'adventures', keywords: ['reservation', 'concert'] },
  { category: 'races', keywords: ['race', 'marathon', 'hike'] },
  { category: 'work', keywords: ['meeting', 'call', '1:1'] },
];
```

Custom categories can be created by users. They:
- Match **titles only** (no description/location scanning)
- Support `any` (OR) or `all` (AND) keyword matching
- Are evaluated before defaults in alphabetical order (case-insensitive)
- Appear after the default categories in the legend (alphabetical within custom)
- Built-in categories can be disabled from settings; disabled items are excluded from matching and the legend, falling back to `Uncategorized`.

**Color Palette** (Tailwind defaults):

| Category | Color | Hex |
|----------|-------|-----|
| Birthdays | Yellow | #F59E0B |
| Family | Blue | #3B82F6 |
| Holidays | Orange | #F97316 |
| Adventures | Red | #EF4444 |
| Races | Green | #10B981 |
| Work | Purple | #8B5CF6 |
| Uncategorized | Gray | #9CA3AF |

## Data Flow

```
┌─────────────────┐
│  Google OAuth   │
│  (GIS library)  │
└────────┬────────┘
         │ access_token
         ▼
┌─────────────────┐
│ Calendar API    │
│ fetchEvents()   │
└────────┬────────┘
         │ raw events
         ▼
┌─────────────────┐
│ processEvents() │
│ - Filter        │
│ - Categorize    │
└────────┬────────┘
         │ YearbirdEvent[]
         ▼
┌─────────────────┐
│ localStorage    │
│ cache           │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ useFilters()    │
│ apply filters   │
└────────┬────────┘
         │ visible events
         ▼
┌─────────────────┐
│ YearGrid        │
│ render          │
└─────────────────┘
```

Calendar visibility uses the Calendar API calendarList endpoint plus
`yearbird:disabled-calendars` to decide which calendar IDs are fetched.

## Component Structure

```
App
├── LandingPage (unauthenticated)
│   └── Sign In Button
│
└── AuthenticatedLayout (authenticated)
    ├── Header
    │   ├── YearPicker
    │   ├── RefreshButton
    │   └── SignOutButton
    │
    ├── YearGrid
    │   ├── DayHeaders (1-31)
    │   └── MonthRow (x12)
    │       ├── MonthLabel
    │       ├── DayCells
    │       └── EventBars
    │           └── EventBar (x many)
    │
    ├── ColorLegend
    │
    ├── EventTooltip (floating)
    │
    └── FilterPanel (dialog)
```

## Testing Strategy

- **Unit tests**: Utility functions (dateUtils, categorize, eventProcessor)
- **Component tests**: Key components with React Testing Library
- **Manual testing**: OAuth flow, visual appearance

## Performance Considerations

| Concern | Solution |
|---------|----------|
| Initial load | Lazy load non-critical components |
| Year of events | Fetch once, cache in localStorage |
| Rendering 365 cells | CSS Grid (browser-optimized) |
| Event bar calculations | Memoize with useMemo |
| Multiple re-renders | React.memo for pure components |

## Security

| Concern | Mitigation |
|---------|------------|
| OAuth tokens | Stored in localStorage, cleared on sign out |
| XSS | React's built-in escaping, no dangerouslySetInnerHTML |
| CSRF | Not applicable (no server, no cookies) |
| Data exposure | Read-only scope, data stays in browser |
