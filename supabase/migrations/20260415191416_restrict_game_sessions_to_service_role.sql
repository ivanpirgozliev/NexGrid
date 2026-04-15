/*
  # Restrict game_sessions to service role only

  1. Security Changes
    - Remove INSERT policy from game_sessions (only service role via edge functions can create sessions)
    - Remove SELECT policy from game_sessions (only service role needs to read sessions)
    - This prevents users from creating fake game sessions via direct API calls
    - Edge functions use service_role key which bypasses RLS
  
  2. Important Notes
    - Game sessions can only be created through the start-game edge function
    - Game sessions can only be validated/completed through the submit-score edge function
    - No authenticated user can directly manipulate game_sessions table
*/

DROP POLICY IF EXISTS "Users can insert own game sessions" ON game_sessions;
DROP POLICY IF EXISTS "Users can read own game sessions" ON game_sessions;
DROP POLICY IF EXISTS "Users can update own game sessions" ON game_sessions;