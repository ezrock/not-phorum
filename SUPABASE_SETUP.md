# Supabase Setup Guide for Freak On!

This guide will help you set up Supabase authentication and database for your forum.

## Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project" or "New Project"
3. Sign in with GitHub (recommended)
4. Create a new organization if you don't have one
5. Click "New Project" and fill in:
   - **Name**: `freakon` (or whatever you prefer)
   - **Database Password**: Choose a strong password (save it somewhere safe!)
   - **Region**: Choose the closest to Finland (e.g., `West EU (Ireland)`)
6. Click "Create new project" (takes ~2 minutes)

## Step 2: Get Your API Keys

1. Once your project is ready, go to **Settings** (gear icon in sidebar)
2. Click **API** in the settings menu
3. You'll see:
   - **Project URL**: `https://xxxxxxxxxxxxx.supabase.co`
   - **anon/public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (long string)

## Step 3: Set Up Environment Variables Locally

1. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```

2. Edit `.env.local` and add your keys:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxx
   ```

## Step 4: Run the Database Migration

1. In your Supabase project, go to **SQL Editor** (in the sidebar)
2. Click "New query"
3. Open the file `supabase/migrations/001_initial_schema.sql`
4. Copy ALL the SQL code from that file
5. Paste it into the Supabase SQL Editor
6. Click "Run" (bottom right)
7. You should see "Success. No rows returned" ✅

This creates:
- `profiles` table (user profiles with username and avatar)
- `categories` table (forum categories)
- `topics` table (forum topics/threads)
- `posts` table (posts within topics)
- `post_likes` table (likes on posts)
- All necessary Row Level Security policies
- Automatic profile creation on signup

## Step 5: Verify the Setup

1. Go to **Table Editor** in Supabase
2. You should see these tables:
   - ✅ profiles
   - ✅ categories
   - ✅ topics
   - ✅ posts
   - ✅ post_likes

3. Click on **categories** table
4. You should see 4 rows:
   - 🎮 Pelit
   - 💻 Teknologia
   - 💬 Yleinen
   - 🎬 Harrastukset

## Step 6: Configure Email Authentication

1. Go to **Authentication** → **Providers** in Supabase
2. Make sure **Email** is enabled (it should be by default)
3. For development, disable email confirmation:
   - Go to **Authentication** → **URL Configuration**
   - Scroll down to **Email Auth**
   - Uncheck "Confirm email" (you can enable this later in production)

## Step 7: Test Locally

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Go to `http://localhost:3000`
3. Try to access `/forum` - you should be redirected to `/login`
4. Click "Rekisteröidy" (Register)
5. Fill in:
   - Username: `testuser`
   - Email: `test@example.com`
   - Password: `password123`
   - Avatar: Pick an emoji
6. Click register
7. You should be logged in and redirected to the forum!

## Step 8: Deploy to Vercel

### Option A: Using Vercel Dashboard

1. Go to [https://vercel.com](https://vercel.com)
2. Click "Add New..." → "Project"
3. Import your GitHub repository
4. Before deploying, add environment variables:
   - Click "Environment Variables"
   - Add `NEXT_PUBLIC_SUPABASE_URL` = your URL
   - Add `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your key
5. Click "Deploy"

### Option B: Using Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Login:
   ```bash
   vercel login
   ```

3. Deploy:
   ```bash
   vercel
   ```

4. Add environment variables:
   ```bash
   vercel env add NEXT_PUBLIC_SUPABASE_URL
   vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
   ```

5. Redeploy:
   ```bash
   vercel --prod
   ```

## Step 9: Configure Vercel Domain in Supabase

1. After deploying to Vercel, copy your domain (e.g., `freakon.vercel.app`)
2. In Supabase, go to **Authentication** → **URL Configuration**
3. Add your Vercel domain to **Site URL**:
   ```
   https://freakon.vercel.app
   ```
4. Add to **Redirect URLs**:
   ```
   https://freakon.vercel.app/**
   ```

## Troubleshooting

### "Invalid API key" error
- Check that your `.env.local` file has the correct keys
- Restart your dev server after adding env variables

### Can't access forum after login
- Check browser console for errors
- Verify middleware is running (check Network tab)
- Make sure Supabase tables were created correctly

### Email confirmation not working
- For development, disable email confirmation in Supabase
- For production, configure SMTP settings in Supabase

### Vercel deployment fails
- Check that env variables are set in Vercel dashboard
- Check build logs for specific errors
- Make sure all TypeScript errors are fixed

## Next Steps

Now that Supabase is set up:

1. ✅ Users can register and login
2. ✅ Forum is protected (login required)
3. ✅ All data is stored securely in PostgreSQL
4. ✅ Row Level Security ensures users can only edit their own content

You can now:
- Create topics and posts (need to build the forms)
- Add user profiles
- Implement likes functionality
- Add moderation features
- Deploy to production!

## Useful Supabase Features

### Real-time subscriptions
```javascript
// Listen for new posts in real-time
supabase
  .channel('posts')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'posts'
  }, (payload) => {
    console.log('New post!', payload)
  })
  .subscribe()
```

### File storage (for user avatars, images)
- Go to **Storage** in Supabase
- Create a bucket for user uploads
- Use Supabase Storage API

### Database backups
- Go to **Database** → **Backups**
- Automatic daily backups on paid plans
- Manual backups anytime

## Support

- Supabase Docs: https://supabase.com/docs
- Supabase Discord: https://discord.supabase.com
- Next.js + Supabase: https://supabase.com/docs/guides/getting-started/quickstarts/nextjs
