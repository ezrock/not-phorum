-- Add hierarchy columns to categories
ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id bigint REFERENCES categories(id);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS era text;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order int DEFAULT 0;

-- Insert parent categories
INSERT INTO categories (name, slug, icon, description, sort_order) VALUES
  ('Videopelit', 'videopelit', '🎮', 'Videopelit ja konsolit', 1),
  ('Retro', 'retro', '🕹️', 'Retrotietokoneet ja -konsolit', 2),
  ('Lauta-, kortti- ja figupelit', 'lauta-kortti-figupelit', '🎲', 'Lauta-, kortti- ja figupelit', 3),
  ('Yleiset', 'yleiset', '💬', 'Yleiset aiheet', 4);

-- Videopelit subcategories (ordered by lifespan, newest first)
-- PC/mobile/web have no era, sorted first
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'videopelit'), sort_order = 1 WHERE slug = 'pc-pelit';
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'videopelit'), sort_order = 2 WHERE slug = 'selainpelit';
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'videopelit'), sort_order = 3 WHERE slug = 'mobiilipelit';
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'videopelit'), sort_order = 4, era = '2022–' WHERE slug = 'steamdeck';
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'videopelit'), sort_order = 5, era = '2020–' WHERE slug = 'playstation-5';
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'videopelit'), sort_order = 6, era = '2020–' WHERE slug = 'xbox-series';
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'videopelit'), sort_order = 7, era = '2017–' WHERE slug = 'nintendo-switch';
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'videopelit'), sort_order = 8, era = '2013–2021' WHERE slug = 'playstation-4';
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'videopelit'), sort_order = 9, era = '2013–2020' WHERE slug = 'xbox-one';
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'videopelit'), sort_order = 10, era = '2006–2017' WHERE slug = 'playstation-3';
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'videopelit'), sort_order = 11, era = '2006–2013' WHERE slug = 'nintendo-wii';
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'videopelit'), sort_order = 12, era = '2005–2016' WHERE slug = 'xbox-360';
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'videopelit'), sort_order = 13, era = '2004–2014' WHERE slug = 'nintendo-ds';
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'videopelit'), sort_order = 14, era = '2001–2007' WHERE slug = 'gamecube';
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'videopelit'), sort_order = 15, era = '2001–2009' WHERE slug = 'xbox';
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'videopelit'), sort_order = 16, era = '2000–2013' WHERE slug = 'playstation-2';
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'videopelit'), sort_order = 17, era = '1996–2002' WHERE slug = 'nintendo-64';
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'videopelit'), sort_order = 18, era = '1994–2006' WHERE slug = 'playstation-1';
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'videopelit'), sort_order = 19, era = '1989–2003' WHERE slug = 'gameboy';

-- Retro subcategories (alphabetical)
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'retro'), sort_order = 1 WHERE slug = 'amiga';
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'retro'), sort_order = 2 WHERE slug = '8-bit-commodore';
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'retro'), sort_order = 3 WHERE slug = 'arcade';
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'retro'), sort_order = 4 WHERE slug = 'dreamcast';
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'retro'), sort_order = 5 WHERE slug = 'gamepark';
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'retro'), sort_order = 6 WHERE slug = 'n-gage';
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'retro'), sort_order = 7 WHERE slug = 'nes';
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'retro'), sort_order = 8 WHERE slug = 'snes';

-- Lauta-, kortti- ja figupelit subcategories (alphabetical)
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'lauta-kortti-figupelit'), sort_order = 1 WHERE slug = 'figut';
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'lauta-kortti-figupelit'), sort_order = 2 WHERE slug = 'korttipelit';
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'lauta-kortti-figupelit'), sort_order = 3 WHERE slug = 'lautapelit';
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'lauta-kortti-figupelit'), sort_order = 4 WHERE slug = 'pokemonit';
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'lauta-kortti-figupelit'), sort_order = 5 WHERE slug = 'roolipelit';

-- Yleiset subcategories (alphabetical, off-topic last)
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'yleiset'), sort_order = 1 WHERE slug = 'internet';
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'yleiset'), sort_order = 2 WHERE slug = 'kirjat-ja-lehdet';
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'yleiset'), sort_order = 3 WHERE slug = 'leffat';
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'yleiset'), sort_order = 4 WHERE slug = 'musiikki';
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'yleiset'), sort_order = 5 WHERE slug = 'sarjakuvat';
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'yleiset'), sort_order = 6 WHERE slug = 'urheilu';
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'yleiset'), sort_order = 7 WHERE slug = 'vimpaimet';
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'yleiset'), sort_order = 8 WHERE slug = 'off-topic';

-- Clean up: if "Revolution" still exists (was renamed to Wii but Nintendo Wii also exists), remove the duplicate
DELETE FROM categories WHERE slug = 'revolution' AND NOT EXISTS (SELECT 1 FROM topics WHERE category_id = categories.id);
