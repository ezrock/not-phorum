-- Smoke tests for migration 063 tag domain hardening.
-- Safe to run repeatedly: all writes are wrapped in a transaction and rolled back.

BEGIN;

DO $$
DECLARE
  admin_id uuid;
  suffix text := to_char((extract(epoch from clock_timestamp()) * 1000)::bigint, 'FM9999999999999999');

  tag_a_id bigint;
  tag_b_id bigint;
  tag_c_id bigint;
  group_g_id bigint;
  group_h_id bigint;

  ret_member_ids bigint[];
  g_old_order integer;
  h_old_order integer;
  g_new_order integer;
  h_new_order integer;

  alias_from_group text;
  test_group_name text;
  test_group_slug text;
  test_group_h_name text;
  test_group_h_slug text;
  test_tag_a_name text;
  test_tag_a_slug text;
  test_tag_b_name text;
  test_tag_b_slug text;
  test_tag_c_name text;
  test_tag_c_slug text;

  picker_ids bigint[];
BEGIN
  SELECT p.id
  INTO admin_id
  FROM profiles p
  WHERE COALESCE(p.is_admin, false) = true
  ORDER BY p.created_at ASC NULLS LAST, p.id ASC
  LIMIT 1;

  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'Smoke test failed: no admin profile found';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', admin_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  test_tag_a_name := 'Smoke Tag A ' || suffix;
  test_tag_b_name := 'Smoke Tag B ' || suffix;
  test_tag_c_name := 'Smoke Tag C ' || suffix;
  test_tag_a_slug := 'smoke-tag-a-' || suffix;
  test_tag_b_slug := 'smoke-tag-b-' || suffix;
  test_tag_c_slug := 'smoke-tag-c-' || suffix;

  test_group_name := 'Smoke Group G ' || suffix;
  test_group_slug := 'smoke-group-g-' || suffix;
  test_group_h_name := 'Smoke Group H ' || suffix;
  test_group_h_slug := 'smoke-group-h-' || suffix;
  alias_from_group := 'smoke-group-alias-' || suffix;

  SELECT t.id INTO tag_a_id
  FROM create_admin_tag(test_tag_a_name, test_tag_a_slug) t;

  SELECT t.id INTO tag_b_id
  FROM create_admin_tag(test_tag_b_name, test_tag_b_slug) t;

  SELECT t.id INTO tag_c_id
  FROM create_admin_tag(test_tag_c_name, test_tag_c_slug) t;

  SELECT g.group_id, g.member_tag_ids
  INTO group_g_id, ret_member_ids
  FROM upsert_tag_group(
    NULL,
    test_group_name,
    test_group_slug,
    'smoke',
    true,
    ARRAY[tag_a_id, tag_b_id],
    'both',
    NULL
  ) g;

  IF ret_member_ids <> ARRAY[tag_a_id, tag_b_id] THEN
    RAISE EXCEPTION 'Smoke test failed: initial member order mismatch: %', ret_member_ids;
  END IF;

  SELECT g.member_tag_ids
  INTO ret_member_ids
  FROM upsert_tag_group(
    group_g_id,
    test_group_name,
    test_group_slug,
    'smoke update',
    true,
    ARRAY[tag_b_id, tag_a_id, tag_c_id],
    'both',
    NULL
  ) g;

  IF ret_member_ids <> ARRAY[tag_b_id, tag_a_id, tag_c_id] THEN
    RAISE EXCEPTION 'Smoke test failed: updated member order mismatch: %', ret_member_ids;
  END IF;

  IF (SELECT gm.sort_order FROM tag_group_members gm WHERE gm.group_id = group_g_id AND gm.tag_id = tag_b_id) <> 0 THEN
    RAISE EXCEPTION 'Smoke test failed: expected tag B sort_order 0';
  END IF;
  IF (SELECT gm.sort_order FROM tag_group_members gm WHERE gm.group_id = group_g_id AND gm.tag_id = tag_a_id) <> 1 THEN
    RAISE EXCEPTION 'Smoke test failed: expected tag A sort_order 1';
  END IF;
  IF (SELECT gm.sort_order FROM tag_group_members gm WHERE gm.group_id = group_g_id AND gm.tag_id = tag_c_id) <> 2 THEN
    RAISE EXCEPTION 'Smoke test failed: expected tag C sort_order 2';
  END IF;

  SELECT g.group_id
  INTO group_h_id
  FROM upsert_tag_group(
    NULL,
    test_group_h_name,
    test_group_h_slug,
    'smoke h',
    true,
    ARRAY[tag_c_id],
    'arrangement',
    NULL
  ) g;

  SELECT tg.arrangement_order INTO g_old_order FROM tag_groups tg WHERE tg.id = group_g_id;
  SELECT tg.arrangement_order INTO h_old_order FROM tag_groups tg WHERE tg.id = group_h_id;

  PERFORM swap_tag_group_arrangement_order(group_g_id, group_h_id);

  SELECT tg.arrangement_order INTO g_new_order FROM tag_groups tg WHERE tg.id = group_g_id;
  SELECT tg.arrangement_order INTO h_new_order FROM tag_groups tg WHERE tg.id = group_h_id;

  IF g_new_order <> h_old_order OR h_new_order <> g_old_order THEN
    RAISE EXCEPTION 'Smoke test failed: arrangement order swap mismatch (before g/h=%/% after g/h=%/%)',
      g_old_order, h_old_order, g_new_order, h_new_order;
  END IF;

  PERFORM add_tag_group_alias(group_g_id, alias_from_group);

  BEGIN
    PERFORM add_tag_alias(tag_a_id, alias_from_group);
    RAISE EXCEPTION 'Smoke test failed: expected add_tag_alias to reject group alias conflict';
  EXCEPTION
    WHEN OTHERS THEN
      IF position('tagiryhmällä' IN SQLERRM) = 0 THEN
        RAISE;
      END IF;
  END;

  PERFORM add_tag_alias(tag_a_id, 'smoke-tag-alias-' || suffix);

  BEGIN
    PERFORM create_admin_tag('smoke-tag-alias-' || suffix, NULL);
    RAISE EXCEPTION 'Smoke test failed: expected create_admin_tag to reject tag alias conflict';
  EXCEPTION
    WHEN OTHERS THEN
      IF position('tagialiaksena' IN SQLERRM) = 0 THEN
        RAISE;
      END IF;
  END;

  BEGIN
    PERFORM create_admin_tag(test_group_name, NULL);
    RAISE EXCEPTION 'Smoke test failed: expected create_admin_tag to reject group name conflict';
  EXCEPTION
    WHEN OTHERS THEN
      IF position('tagiryhmällä' IN SQLERRM) = 0 THEN
        RAISE;
      END IF;
  END;

  SELECT array_agg(p.id ORDER BY p.group_order NULLS LAST, p.tag_order NULLS LAST, p.name)
  INTO picker_ids
  FROM get_tag_picker_options(alias_from_group, 10, NULL, NULL) p;

  IF picker_ids IS NULL OR array_length(picker_ids, 1) < 3 THEN
    RAISE EXCEPTION 'Smoke test failed: picker did not return expected rows for group alias';
  END IF;

  IF picker_ids[1] <> tag_b_id OR picker_ids[2] <> tag_a_id OR picker_ids[3] <> tag_c_id THEN
    RAISE EXCEPTION 'Smoke test failed: picker order mismatch for group alias: %', picker_ids;
  END IF;

  RAISE NOTICE '063 smoke tests passed';
END;
$$;

ROLLBACK;
