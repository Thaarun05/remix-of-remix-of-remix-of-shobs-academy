REVOKE EXECUTE ON FUNCTION public.get_family_children() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_family_sibling(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_parent_admin_conv_participant(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.enforce_parent_admin_message_update_scope() FROM PUBLIC, anon;