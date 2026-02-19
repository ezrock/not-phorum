-- Smoke test for migration 067:
-- verifies upsert_tag_group member sync works when create/update is executed,
-- and no "WITH clause containing a data-modifying statement must be at the top level" error occurs.
--
-- Safe to run repeatedly: writes are wrapped in transaction and rolled back.

BEGIN;

DO $$
DECLARE
  admin_id uuid;
  suffix text := to_char((extract(epoch from clock_timestamp()) * 1000)::bigint, 'FM9999999999999999');

  tag_a_id bigint;
  tag_b_id bigint;
  tag_c_id bigint;

  group_id_value bigint;
  member_ids bigint[];
BEGIN
  SELECT p.id
  INTO admin_id
  FROM profiles p
  WHERE COALESCE(p.is_admin, false) = true
  ORDER BY p.created_at ASC NULLS LAST, p.id ASC
  LIMIT 1;

  IF admin_id IS NULL THEN
    RAISE EXCEPTION '067 smoke failed: no admin profile found';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', admin_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  SELECT t.id INTO tag_a_id
  FROM create_admin_tag('067 Smoke Tag A ' || suffix, '067-smoke-tag-a-' || suffix) t;

  SELECT t.id INTO tag_b_id
  FROM create_admin_tag('067 Smoke Tag B ' || suffix, '067-smoke-tag-b-' || suffix) t;

  SELECT t.id INTO tag_c_id
  FROM create_admin_tag('067 Smoke Tag C ' || suffix, '067-smoke-tag-c-' || suffix) t;

  -- Create group with two members (critical path previously failing with CTE placement error).
  SELECT g.group_id, g.member_tag_ids
  INTO group_id_value, member_ids
  FROM upsert_tag_group(
    NULL,
    '067 Smoke Group ' || suffix,
    '067-smoke-group-' || suffix,
    'smoke',
    true,
    ARRAY[tag_a_id, tag_b_id],
    'both',
    NULL
  ) g;

  IF group_id_value IS NULL THEN
    RAISE EXCEPTION '067 smoke failed: upsert_tag_group did not return group id on create';
  END IF;

  IF member_ids <> ARRAY[tag_a_id, tag_b_id] THEN
    RAISE EXCEPTION '067 smoke failed: create member order mismatch: %', member_ids;
  END IF;

  -- Update order and add 3rd member.
  SELECT g.member_tag_ids
  INTO member_ids
  FROM upsert_tag_group(
    group_id_value,
    '067 Smoke Group ' || suffix,
    '067-smoke-group-' || suffix,
    'smoke update',
    true,
    ARRAY[tag_b_id, tag_c_id, tag_a_id],
    'both',
    NULL
  ) g;

  IF member_ids <> ARRAY[tag_b_id, tag_c_id, tag_a_id] THEN
    RAISE EXCEPTION '067 smoke failed: update member order mismatch: %', member_ids;
  END IF;

  -- Clear members using NULL member list.
  SELECT g.member_tag_ids
  INTO member_ids
  FROM upsert_tag_group(
    group_id_value,
    '067 Smoke Group ' || suffix,
    '067-smoke-group-' || suffix,
    'smoke clear',
    true,
    NULL,
    'both',
    NULL
  ) g;

  IF COALESCE(array_length(member_ids, 1), 0) <> 0 THEN
    RAISE EXCEPTION '067 smoke failed: expected empty member list after clear, got: %', member_ids;
  END IF;

  RAISE NOTICE '067 smoke tests passed';
END;
$$;

ROLLBACK;
