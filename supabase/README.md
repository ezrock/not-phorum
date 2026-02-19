# Supabase DB Guide

This document summarizes the current runtime data model and RPC contract for new developers.

## 1) Current Source Of Truth

- Topics are tag-first.
- `topics.category_id` is legacy compatibility metadata only.
- Runtime filtering/discovery should use `topic_tags` + `tags`.

Core entities:
- `topics`: thread metadata (`category_id` nullable legacy field).
- `posts`: thread messages.
- `tags`: canonical tags + moderation state + alias redirect pointer (`redirect_to_tag_id`).
- `topic_tags`: many-to-many mapping between topics and tags.
- `tag_aliases`: admin-managed synonyms/nicknames for search.
- `tag_groups`: admin-managed browse/search groups (non-selectable as topic tags).
- `tag_group_members`: group membership for canonical tags.

## 2) Tag Model

Canonical tag:
- `tags.redirect_to_tag_id IS NULL`

Merged/alias tag:
- `tags.redirect_to_tag_id IS NOT NULL`
- Usually status `hidden`

Canonicalization helpers:
- `resolve_canonical_tag_id(bigint)`
- `resolve_canonical_tag_ids(bigint[])`

Alias behavior:
- Aliases are globally unique by normalized value (`tag_aliases.normalized_alias` unique).
- Duplicate alias conflicts should return user-facing error:
  - `alias on jo käytössä tagilla X`

## 3) Main RPCs (runtime)

Topic creation/listing/filtering:
- `create_topic_with_post(...)`
- `get_topic_list_state(...)`
- `get_topic_list_state_filtered(...)`
- `get_topic_count_filtered(...)`

Search:
- `search_forum(search_term, result_limit)` for content hits.
- `search_tag_groups(input_query, input_limit)` for group hits.
- Tag hits are usually resolved through tag API + alias matching.

Tag admin/moderation:
- `get_unreviewed_tags_with_usage()`
- `moderate_tag(...)`
- `merge_tags(source_tag_id, target_tag_id)`
- `update_tag_details(...)` (name + slug + optional old alias creation)
- `get_tag_aliases()`
- `add_tag_alias(...)`
- `delete_tag_alias(...)`

Tag groups admin:
- `get_tag_groups_with_members()`
- `upsert_tag_group(...)`
- `delete_tag_group(...)`

## 4) Security Standards

Conventions used:
- RPCs are `SECURITY DEFINER` and explicitly check `auth.uid()`.
- Admin RPCs must verify `profiles.is_admin`.
- `SET search_path = public` is required in security definer functions.
- Public execute is revoked, execute granted to `authenticated`.

RLS:
- Enabled on core mutable tables (`tags`, `topic_tags`, `tag_aliases`, `tag_groups`, `tag_group_members`, etc.).
- Write policies restricted to owner/admin depending on table purpose.

## 5) Performance Standards

Search indexes:
- `pg_trgm` extension enabled.
- Trigram GIN indexes for:
  - `topics.title`
  - `posts.content`
  - `tag_aliases.alias`
  - `tag_groups.name`
  - `tag_groups.slug`

Tag filtering indexes:
- `topic_tags(tag_id, topic_id, created_at DESC)`
- `topic_tags(topic_id, tag_id, created_at DESC)`

Note:
- Keep index set minimal and validated with `EXPLAIN ANALYZE` against real workloads.

## 6) Migration Hygiene Rules

- One unique numeric prefix per migration file (no duplicate numbers).
- Never edit old applied migrations in production.
- Use new forward migrations for fixes/refactors.
- Keep function overrides intentional and documented in migration header comments.

## 7) Known Legacy Areas

- Older migrations include category-era logic and earlier function versions.
- Current runtime behavior is determined by latest migrations (`042+` and onward).
- Category fields in some result payloads are compatibility placeholders.

## 8) Smoke Tests

Run these in Supabase SQL Editor after applying migrations:

- `supabase/tests/063_tag_domain_regression_smoke.sql`

Coverage:
- tag/group alias conflict rules
- atomic arrangement order swap
- tag group member order persistence
- tag picker ordering via group alias search

Safety:
- script wraps writes in a transaction and ends with `ROLLBACK`
