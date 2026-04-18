/*
  # Harden profiles grants

  ## Summary
  - Removes all direct anon privileges on profiles
  - Keeps only authenticated privileges required by app flows
*/

REVOKE ALL ON TABLE public.profiles FROM anon;

REVOKE ALL ON TABLE public.profiles FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;
