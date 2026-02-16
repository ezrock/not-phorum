-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create profiles table (extends auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  avatar text not null default '🎮',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,

  constraint username_length check (char_length(username) >= 3 and char_length(username) <= 20)
);

-- Enable Row Level Security
alter table public.profiles enable row level security;

-- Profiles policies
create policy "Public profiles are viewable by everyone"
  on public.profiles for select
  using ( true );

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile"
  on public.profiles for update
  using ( auth.uid() = id );

-- Create categories table
create table public.categories (
  id bigint generated always as identity primary key,
  name text not null,
  description text not null,
  icon text not null,
  slug text unique not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.categories enable row level security;

create policy "Categories are viewable by authenticated users"
  on public.categories for select
  using ( auth.role() = 'authenticated' );

-- Create topics table
create table public.topics (
  id bigint generated always as identity primary key,
  category_id bigint references public.categories on delete cascade not null,
  author_id uuid references public.profiles on delete cascade not null,
  title text not null,
  is_pinned boolean default false,
  is_locked boolean default false,
  views bigint default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,

  constraint title_length check (char_length(title) >= 3 and char_length(title) <= 200)
);

alter table public.topics enable row level security;

create policy "Topics are viewable by authenticated users"
  on public.topics for select
  using ( auth.role() = 'authenticated' );

create policy "Authenticated users can create topics"
  on public.topics for insert
  with check ( auth.role() = 'authenticated' and auth.uid() = author_id );

create policy "Authors can update own topics"
  on public.topics for update
  using ( auth.uid() = author_id );

-- Create posts table
create table public.posts (
  id bigint generated always as identity primary key,
  topic_id bigint references public.topics on delete cascade not null,
  author_id uuid references public.profiles on delete cascade not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,

  constraint content_length check (char_length(content) >= 1 and char_length(content) <= 10000)
);

alter table public.posts enable row level security;

create policy "Posts are viewable by authenticated users"
  on public.posts for select
  using ( auth.role() = 'authenticated' );

create policy "Authenticated users can create posts"
  on public.posts for insert
  with check ( auth.role() = 'authenticated' and auth.uid() = author_id );

create policy "Authors can update own posts"
  on public.posts for update
  using ( auth.uid() = author_id );

create policy "Authors can delete own posts"
  on public.posts for delete
  using ( auth.uid() = author_id );

-- Create post_likes table
create table public.post_likes (
  id bigint generated always as identity primary key,
  post_id bigint references public.posts on delete cascade not null,
  user_id uuid references public.profiles on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,

  unique(post_id, user_id)
);

alter table public.post_likes enable row level security;

create policy "Likes are viewable by authenticated users"
  on public.post_likes for select
  using ( auth.role() = 'authenticated' );

create policy "Users can like posts"
  on public.post_likes for insert
  with check ( auth.role() = 'authenticated' and auth.uid() = user_id );

create policy "Users can unlike posts"
  on public.post_likes for delete
  using ( auth.uid() = user_id );

-- Create function to update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Create triggers for updated_at
create trigger handle_topics_updated_at
  before update on public.topics
  for each row
  execute procedure public.handle_updated_at();

create trigger handle_posts_updated_at
  before update on public.posts
  for each row
  execute procedure public.handle_updated_at();

-- Create function to automatically create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, avatar)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data->>'avatar', '🎮')
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create profile on user signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Insert default categories
insert into public.categories (name, description, icon, slug) values
  ('Pelit', 'Keskustelua peleistä kaikilla alustoilla', '🎮', 'pelit'),
  ('Teknologia', 'Tietokoneet, komponentit ja teknologia', '💻', 'teknologia'),
  ('Yleinen', 'Vapaa keskustelu mistä vain', '💬', 'yleinen'),
  ('Harrastukset', 'Elokuvat, musiikki, urheilu ja muut harrastukset', '🎬', 'harrastukset');

-- Create views for easier querying
create or replace view public.topics_with_stats as
select
  t.*,
  p.username as author_username,
  p.avatar as author_avatar,
  c.name as category_name,
  c.icon as category_icon,
  c.slug as category_slug,
  count(distinct po.id) as reply_count,
  max(po.created_at) as last_activity
from public.topics t
left join public.profiles p on t.author_id = p.id
left join public.categories c on t.category_id = c.id
left join public.posts po on t.id = po.topic_id
group by t.id, p.username, p.avatar, c.name, c.icon, c.slug;

create or replace view public.posts_with_details as
select
  po.*,
  p.username as author_username,
  p.avatar as author_avatar,
  count(distinct pl.id) as likes_count
from public.posts po
left join public.profiles p on po.author_id = p.id
left join public.post_likes pl on po.id = pl.post_id
group by po.id, p.username, p.avatar;
