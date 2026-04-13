/*
  # Auto-create Profile on User Signup

  ## Summary
  Adds a PostgreSQL trigger that automatically creates a `profiles` row
  whenever a new user is inserted into `auth.users`. The username is read
  from `raw_user_meta_data->>'username'` so it works regardless of whether
  email confirmation is enabled.

  ## Changes
  - New function `handle_new_user()` (security definer, runs as postgres)
  - Trigger `on_auth_user_created` fires AFTER INSERT on `auth.users`

  ## Why this is needed
  When email confirmation is required the client has no active session at
  signup time, so a direct INSERT from the frontend is rejected by RLS.
  Running as `security definer` bypasses RLS and is safe because it is
  triggered only by the auth system.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
