/*
  # Restrict score inserts to service role only

  ## Summary
  Removes the policy that allowed authenticated users to insert scores directly.
  Now only the service_role (used by the submit-score edge function) can insert scores,
  preventing users from submitting fake scores via the client.

  ## Changes
  - Drop "Users can insert own scores" policy on `scores` table
  - No new INSERT policy for authenticated users (service_role bypasses RLS)

  ## Security
  - Authenticated users can still SELECT scores (unchanged)
  - Score submission now goes through the edge function which validates data
  - The edge function uses service_role key to insert validated scores
*/

DROP POLICY IF EXISTS "Users can insert own scores" ON scores;
