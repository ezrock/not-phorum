Goal
- Modern message board with secure features and possibility to build lots of fun easter eggs. 

## Content
- Threads, posts, replies, files
- Threads are flat but replies can reference posts. 

## Architecture
- Hosted & deployment in Vercel
- Frontend and server logic in Next.js 
- Version control in Github
- Auth, database and storage in Supabase
- Media management for attachments and images in Cloudinary

## URL Strategy
- Bigint + slug
- Should be linkable, but only the registered uers can see the contents.

## General features
- Access to forum only by login
- Keep data encrypted to protect it from data breaches

## Landing page
- Contains only text.

## Thread list
- First page after login.
- Paginated

## Admin features
- Remove message
- Edit message
- Rename thread
- Remove thread
- Change thread category
- Change username of users
- Edit user information of users

## User features
- Start new threads
- Reply to a thread
- Reply to a thread refering a message or user

## Categories
- Built with categories and subcategories.
- Videogame categories are sorted by the release date, other topics by the estimated popularity
- Off-topic is the default category

### Videopelit
PC-pelit 💻
Selainpelit 🌐
Mobiilipelit 📱
Steamdeck 🎮 (2022–)
Playstation 5 🎮 (2020–)
Xbox Series 💚 (2020–)
Nintendo Switch 🔴 (2017–)
Playstation 4 🎮 (2013–2021)
Xbox One 💚 (2013–2020)
Playstation 3 🎮 (2006–2017)
Nintendo Wii 🏠 (2006–2013)
Xbox 360 💚 (2005–2016)
Nintendo DS 📱 (2004–2014)
Gamecube 🟪 (2001–2007)
Xbox 💚 (2001–2009)
Playstation 2 📀 (2000–2013)
Nintendo 64 🕹️ (1996–2002)
Playstation 1 💿 (1994–2006)
Gameboy 🟩 (1989–2003)


### Retro 🕹️
Amiga 🖥️
8-bit Commodore 💾
Arcade 🕹️
Dreamcast 🌀
Gamepark 🎮
N.Gage 📞
NES 🕹️
SNES 🎮

### Lauta-, kortti- ja figupelit 🎲
Figut 🧸
Korttipelit 🃏
Lautapelit 🎲
Pokemonit ⚡
Roolipelit 🐉

### Yleiset 💬
Internet 🌍
Kirjat ja lehdet 📚
Leffat 🎬
Musiikki 🎵
Sarjakuvat 📖
Urheilu ⚽
Vimpaimet 🔧
Off-topic 💬

## Category management
- Admin can edit categories
- Admin can add new categories
- Admin can add image for a category
- Admin can sort the categories

## Message features
- Use markdown to style the messages.
- Can contain hashtags
- Can contain @user mentions
- Add attachments to messages
- Images are shown inline

## Thread features
- User who started the thread can change the category
- User who started the thread can lock the thread.

## User profile
- User has a username
- User can upload a profile image
- User can add a name
- User can change their email address
- User can change their signature
- User can toggle signature on/off
- User can set one link to their profile (Url and description)

- User profile shows the date the user profile has been created (migrated later)

- Card based layout: Basic information, trophies, statistics, trophies

## Statistics in user profile (in own and other users profiles)
- Threads started
- Replies written
- Times logged in
- Most popular thread started (views)
- Most active thread started (replies)

## Search features
- Real time search
- Less prone to error (typos should not matter a lot)
- Search from message content and thread names
