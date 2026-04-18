/*
  # Restrict get_user_stats RPC execution

  ## Summary
  - Ensures anon role cannot execute get_user_stats
  - Keeps execution for authenticated and service_role
*/

REVOKE ALL ON FUNCTION public.get_user_stats(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_stats(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_user_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_stats(uuid) TO service_role;
