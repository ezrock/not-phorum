# Freakon Forum

Yarr! A modern, members-only message board built with Next.js + Supabase, with old-school forum soul and modern security hardening.

## Tech Stack
- Next.js (App Router, React, TypeScript)
- Supabase (Postgres, Auth, RLS, SQL RPC functions)
- Cloudinary (post attachments and profile images)
- Tailwind CSS + custom UI components
- Lucide icons
- Vercel (deployment)
- GitHub (version control)

## What Is Already Shipped
- Members-only forum access (auth-gated content)
- Registration toggle from admin panel (`site_settings`)
- Role-based admin access and admin-only controls
- Category hierarchy with parent/child category support
- Thread creation with first post in one atomic RPC (`create_topic_with_post`)
- Thread list with pagination (`?page=`), 20 threads per page
- Thread view with pagination (`?page=`), 50 posts per page
- Open thread links directly to latest post (page + `#post-id` anchor)
- Per-post deep links with copy button and temporary highlight
- Post likes (toggle, per-user), including thread starter post
- Soft-delete for posts
- Post edit flow with edited timestamp handling
- Markdown rendering for messages
- Auto-linking of plain URLs in messages
- Optional image attachment in new posts and replies
- Topic view tracking:
  - total views
  - unique views with cooldown window
  - per-viewer tracking via `topic_view_events`
- “Uusi” badge logic in thread list for unread activity
- Reply count shown in Finnish grammar (`1 vastaus`, `N vastausta`)
- Search page with typo-tolerant DB search RPC (`search_forum`)
- Profile system with:
  - profile image upload
  - signature (and visibility toggle)
  - optional personal link
  - email update
  - admin-only username editing with confirmation modal
- Public profile pages for other users
- Member list page
- Trophy system baseline migrated from legacy forum:
  - trophy catalog + user trophy assignments
  - legacy icon assets served locally
  - trophies visible in member list, profiles, and admin overview
- Profile Top 5 analytics card data:
  - favourite categories
  - most viewed threads
  - top liked posts
  - authors whose posts user has liked most

## Security Notes
- RLS enabled on core tables
- Security-definer RPCs hardened with auth checks
- Login counter increment secured to self-user only
- Admin actions enforced server-side (not just UI)

## Database Migrations
The project includes SQL migrations in `supabase/migrations`, including:
- schema bootstrap
- category hierarchy
- admin role and security hardening
- login counting
- site settings
- trophies baseline
- topic view tracking
- post likes + profile top-5 helpers
- topic list state and pagination helper

## Dev Notes
- Main forum routes:
  - `/forum`
  - `/forum/new`
  - `/forum/topic/[id]`
  - `/forum/search`
  - `/members`
  - `/profile`
  - `/profile/[id]`
  - `/admin`
- If ye be migrating legacy data, trophies are already structured so ye can keep expanding the catalog without rewriting UI logic. Yarr.
