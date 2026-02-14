# Freak On! Forum

Finnish gaming community forum, originally founded 2004. Rebuilt with modern stack.

## Tech Stack
- **Next.js 16** (App Router), **React 19**, **TypeScript**, **Tailwind CSS 4**
- **Supabase**: PostgreSQL, Auth (cookie-based via `@supabase/ssr`), Row Level Security
- **Cloudinary**: Image uploads via `next-cloudinary` CldUploadWidget, URL-based transforms
- **Vercel**: Hosting & deployment
- **lucide-react**: Icons

## Project Structure
```
src/app/
  page.tsx                  # Landing/login page (or redirect to /forum if logged in)
  layout.tsx                # Root layout: AuthProvider > Navigation + main + Footer
  login/page.tsx            # Redirects to / (login form lives on home page)
  register/page.tsx         # Registration form
  forum/page.tsx            # All topics from all categories
  forum/new/page.tsx        # Create topic (category + title + content + image)
  forum/topic/[id]/page.tsx # Topic with posts + reply form
  profile/page.tsx          # Own editable profile
  profile/[id]/page.tsx     # Public profile with stats
  members/page.tsx          # Members list

src/components/layout/      # Navigation.jsx (hidden when not logged in), Footer.jsx
src/components/ui/          # Card, Button, Input, Alert
src/contexts/AuthContext.jsx # Auth state: currentUser, profile, login, logout, register, refreshProfile, supabase
src/lib/cloudinary.ts       # Image URL transform helpers
src/lib/supabase/           # client.ts, server.ts, middleware.ts

middleware.ts               # Route protection, session refresh
supabase/migrations/        # 001_initial_schema, 002_seed_categories, 003_add_image_columns
```

## Supabase Tables
- **profiles**: id, username, avatar, profile_image_url, created_at
- **categories**: id, name, description, icon, slug, created_at (41 gaming categories)
- **topics**: id, title, category_id, author_id, views, reply_count, is_pinned, is_locked, last_activity
- **posts**: id, topic_id, author_id, content, image_url, created_at

## Key Patterns

### Auth flow
- Home page (`/`) shows login form for unauthenticated users, redirects to `/forum` for logged-in users
- Navigation bar is hidden when not logged in
- Middleware protects `/forum`, `/members`, `/profile` routes, redirects to `/`
- Use `window.location.href` (not `router.push`) after login/logout for proper cookie sync

### Middleware cookies
- MUST use `getAll`/`setAll` pattern (not `get`/`set`/`remove` which drops cookies)

### Data fetching
- Client-side: `useAuth()` provides `supabase` client, fetch in `useEffect`
- Supabase joins: `author:profiles!author_id(username, avatar, profile_image_url)`

### Image handling
- Cloudinary URL transforms via `src/lib/cloudinary.ts`: profileThumb (80px), profileMedium (200px), postImage (800px), postThumb (300px)
- All use `f_auto,q_auto` for format/quality optimization, profiles use `g_face` for face detection

## Known Gotchas
- **useState + async data**: Initial values don't update when data loads async. Always use `useEffect` to sync form state from context/props.
- **Don't call signOut() before signInWithPassword()**: It triggers onAuthStateChange mid-login and disrupts the flow.
- **onAuthStateChange must not await**: The callback should fire-and-forget async operations (like fetchProfile), never `await` them.
- **Middleware cookie pattern**: The old `get`/`set`/`remove` pattern creates a new NextResponse per cookie, dropping previous cookies. Always use `getAll`/`setAll`.

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=deq1pvfkv
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=freakon
```

## UI Conventions
- Finnish language UI
- Yellow nav bar (#FBBF24), monospace "FREAK ON!" logo
- Card-based layouts, max-w-6xl content width
- Gray-100 background, gray-800 borders/text
