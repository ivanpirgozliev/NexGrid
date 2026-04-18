/*
  # Harden public grants

  ## Summary
  - Remove unnecessary anon read access to scores/profiles
  - Restrict leaderboard view access to authenticated SELECT only
*/

REVOKE SELECT ON TABLE public.scores FROM anon;
REVOKE SELECT ON TABLE public.profiles FROM anon;

REVOKE ALL ON TABLE public.leaderboard FROM anon, authenticated;
GRANT SELECT ON TABLE public.leaderboard TO authenticated;
