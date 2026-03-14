# Focusly

**Focusly** is a distraction-free productivity app combining a **Pomodoro timer** with an integrated **task management system**. Stay in the zone with customizable focus sessions, manage your to-do list, and sync everything in real time across devices.

---

## Features

- 🍅 **Pomodoro Timer** — Customizable focus, short break, and long break durations with auto-start options
- ✅ **Task Management** — Create, edit, complete, and reorder tasks with drag-and-drop support
- 🏷️ **Task Tags** — Organize tasks with color-coded, emoji-enhanced custom tags
- 🔔 **Push Notifications** — Desktop notifications when a timer session ends
- 🌗 **Dark / Light Mode** — Persistent theme preference
- 🔄 **Real-time Sync** — Live data synchronization across tabs and devices via Supabase Realtime
- 🔐 **User Authentication** — Secure email/password sign-up and login
- ⚙️ **Settings** — Configure timer durations, auto-start behavior, and sound preferences

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, TypeScript, Vite |
| **Styling** | Tailwind CSS, shadcn/ui, Radix UI |
| **State** | React Context, TanStack React Query |
| **Backend** | Supabase (PostgreSQL, Auth, Realtime, Edge Functions) |
| **Drag & Drop** | @hello-pangea/dnd |
| **Testing** | Vitest, Playwright |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later) and npm — install via [nvm](https://github.com/nvm-sh/nvm#installing-and-updating)
- A [Supabase](https://supabase.com/) project

### Installation

```sh
# 1. Clone the repository
git clone <YOUR_REPOSITORY_URL>
cd focusly

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
# Edit .env and fill in your Supabase credentials (see Environment Variables below)

# 4. Start the development server
npm run dev
```

The app will be available at **http://localhost:8080**.

### Environment Variables

Create a `.env` file in the project root with the following values (replace the example values with your own from the Supabase dashboard):

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-id
```

You can find these values in your Supabase project dashboard under **Project Settings → API**.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server with hot-reload |
| `npm run build` | Create a production build |
| `npm run build:dev` | Create a development build |
| `npm run preview` | Preview the production build locally |
| `npm run test` | Run unit tests (Vitest) |
| `npm run test:watch` | Run unit tests in watch mode |
| `npm run lint` | Run ESLint |

### End-to-end Tests (Playwright)

```sh
npx playwright test          # Run all E2E tests
npx playwright test --ui     # Run E2E tests with interactive UI
```

---

## Project Structure

```
focusly/
├── src/
│   ├── components/          # UI components (PomodoroTimer, TodoList, SettingsPanel, …)
│   │   └── ui/              # shadcn/ui base components
│   ├── contexts/            # React context providers (Auth, Settings, Theme)
│   ├── hooks/               # Custom React hooks
│   ├── integrations/
│   │   └── supabase/        # Supabase client & TypeScript types
│   ├── lib/                 # Shared utilities
│   ├── pages/               # Page components (Index, Auth, NotFound)
│   ├── App.tsx              # Root component with routing & providers
│   └── main.tsx             # Application entry point
├── supabase/
│   ├── config.toml          # Supabase project configuration
│   ├── functions/           # Edge Functions (push notifications)
│   └── migrations/          # Database migration files
├── test/                    # Unit & integration tests
├── public/                  # Static assets
└── index.html               # HTML entry point
```

---

## Database Schema

Focusly uses the following Supabase tables:

| Table | Description |
|---|---|
| `tasks` | User tasks with position, completion status, and optional parent for subtasks |
| `tags` | Custom tags with name, color, and optional emoji |
| `task_tags` | Many-to-many relationship between tasks and tags |
| `timer_state` | Persisted Pomodoro timer state per user |
| `user_settings` | User preferences (timer durations, sound, auto-start) |

---

## Deployment

The easiest way to deploy Focusly is via [Lovable](https://lovable.dev) — open your project and click **Share → Publish**.

For self-hosting, run `npm run build` and deploy the generated `dist/` folder to any static hosting service (Vercel, Netlify, Cloudflare Pages, etc.). Make sure to set your environment variables on the hosting platform.

---

## Contributing

1. Fork the repository and create a feature branch
2. Make your changes and ensure all tests pass (`npm run test`)
3. Open a pull request describing your changes
