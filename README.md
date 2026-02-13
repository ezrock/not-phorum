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
- Amiga, Arcade, SNES, Playstation 3, Nintendo DS, Gamecube, Revolution, Nintendo 64, Leffat, Sarjakuvat,Musiikki, Internet, Figut, Korttipelit, Xbox, Lautapelit, Gameboy, Dreamcast, PC-pelit, Gamepark , Kirja ja lehdet, N.Gage, 8-bit Commodore, Off-topic, Roolipelit, Xbox 360, Vimpaimet, Playstation 2, Playstation 1, Pokemonit, Urheilu,     Selainpelit, Mobiilipelit, NES

## Category management
- Admin can edit message categories
- Admin can add new message categories
- Admin can add image for message category

## Message features
- Use markdown to style the messages.
- Can contain hashtags
- Can contain @user mentions
- Add attachments to messages
- Images are shown inline

## Thread features
- User who started the thread can change the category
- User who started the thread can lock the thread.

## User profile features
- User has a username
- User can upload a profile image
- User can add a name
- User can change their email address

## Search features
- 


