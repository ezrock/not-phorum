# Not-Phorum

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
- Registration approval workflow:
  - new users can require admin approval (`pending/approved/rejected`)
  - pending users are gated to `/pending-approval`
  - admin `Käyttäjät` tab includes simple `Approve / Reject`
- Role-based admin access and admin-only controls
- Admin board settings:
  - registration on/off
  - notification strip (`Ilmoitusraita`) on/off
  - editable notification message (`Ilmoitusviesti`)
- Admin event system (`Tapahtumat` tab):
  - event CRUD via modal
  - single-day or date-range events
  - optional yearly recurrence toggle
  - per-event music/logo on/off toggles
  - MIDI and logo file pickers from `public/midi` and `public/logo`
  - missing-file flags in table/modal
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
- Embedded videos for messages
  -Youtube
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
  - settings toggles for:
    - realtime forum updates
    - retro visual filter
    - MIDI playback preference
  - hash-routed profile tabs (`/profile#profile`, `/profile#edit`, `/profile#settings`)
- Public profile pages for other users
- Member list page
- Log page for easy browsing of
  - Liked quotes
  - Latest images
  - Latest videos
- Trophy system baseline migrated from legacy forum:
  - trophy catalog + user trophy assignments
  - legacy icon assets served locally
  - trophies visible in member list, profiles, and admin overview
- Profile Top 5 analytics card data:
  - favourite categories
  - most viewed threads
  - top liked posts
  - authors whose posts user has liked most
- Login/visit stats:
  - login counter
  - privacy-focused distinct network visits counter (`Vierailut eri IP-osoitteista`)
    - no raw IPs stored in app DB, only HMAC fingerprints of normalized networks
- Event-driven background MIDI playback:
  - active event is resolved by date
  - single-day event wins over overlapping range event
  - playback follows per-user MIDI preference + event music settings
  - runtime MIDI parsing + Web Audio synth playback via local player logic (`src/app/midi/midi.js`)

## Security Notes
- RLS enabled on core tables
- Security-definer RPCs hardened with auth checks
- Login counter increment secured to self-user only
- Login-network tracking secured to self-user only (`track_login_network`)
- Admin approval/status changes secured server-side (`set_profile_approval_status`)
- Admin actions enforced server-side (not just UI)
- Privacy-first network tracking:
  - app DB stores only HMAC fingerprints of normalized networks (`/24` IPv4, `/64` IPv6)
  - no raw IP addresses persisted in app tables. Yarr.

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
- profile preferences (`realtime_updates_enabled`, `retro_enabled`, `midi_enabled`)
- event system (`site_events`, logo toggle, date ranges, yearly recurrence)
- login network fingerprint tracking (`profile_login_networks`, `login_network_count`)
- profile approval workflow (`approval_status`, admin approval RPC)

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
  - `/pending-approval`
- If ye be migrating legacy data, trophies are already structured so ye can keep expanding the catalog without rewriting UI logic. Yarr.

## Coming next
- Planning a category revolution with hashtags
  - Replacing categories with inline hashtags (managed by admin)
  - Support for meta categories (handhelds includes Switch, DS, Steamdeck etc)
- Pinned thread)s)
- Better statistics
- Privacy focused analytics with Umami
- Polished styling - now everything is quite basic
  - More compact layout
- Planning the migration
