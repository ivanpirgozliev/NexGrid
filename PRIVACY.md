# NexGrid Privacy Policy

**Last updated: 11 August 2026**

NexGrid is a block-stacking puzzle game with an online leaderboard. This policy
describes exactly what the game stores, why, and where. It covers the desktop
application and the NexGrid API that serves it.

Contact for any question or request in this policy: **ivanpirgozliev@gmail.com**

## What we collect

We only collect what an online leaderboard needs to work. There is no
advertising, no analytics, no tracking, and no profiling of any kind.

**When you create an account**

- **Email address** — used solely as your login identity. We do not send
  marketing email, newsletters, or any other unsolicited mail.
- **Password** — stored only as a bcrypt hash. We never store, log, or have any
  way to read your actual password.
- **Username** — chosen by you.

**When you play**

- **Scores** — your score, level, lines cleared, and the time of each game.
- **Game session data** — when a game started, and periodic "still playing"
  signals sent during play. This exists to detect fabricated scores and keep the
  leaderboard honest. It is deleted along with your account.
- **Last active time** — a timestamp updated while the game is open, used only
  to display the "online now" counter.

**If you choose to upload one**

- **Profile picture** — optional. You can remove it at any time from the profile
  screen.

## What is publicly visible

Your **username**, **profile picture**, and **scores** appear on the in-game
leaderboard to other signed-in players.

Your **email address is never shown to anyone** and is never included in any
leaderboard or profile data sent to other players.

## What we do not collect

- No advertising identifiers, cookies for tracking, or third-party analytics
- No payment or financial information
- No location data
- No contacts, files, camera, microphone, or other device data
- No browsing or usage telemetry outside the game itself

## Where your data is stored

- **Database** — Neon, in the EU (Frankfurt, `eu-central-1`)
- **Profile pictures** — Cloudflare R2, Eastern Europe region
- **API** — Cloudflare Workers

Neon and Cloudflare act as our infrastructure providers. They process data on
our behalf and do not use it for their own purposes.

## Who we share it with

Nobody. We do not sell, rent, or share your data with third parties. Data is
disclosed only if required by law.

## How long we keep it

Your data is kept while your account exists. When you delete your account,
everything listed above — account, scores, session history, and profile
picture — is deleted permanently and immediately.

Expired login tokens are cleaned up automatically.

## Your rights

If you are in the EU/EEA, the GDPR gives you the right to access, correct,
export, restrict, or delete your personal data, and to object to its processing.

**You can delete your account yourself, at any time**, from the Profile screen
in the game: *Delete account* → confirm with your password. This immediately and
permanently removes your account, your scores, your game history and your
profile picture. Your entries disappear from the leaderboard. It cannot be
undone.

For any other request — access, correction, or export — email
ivanpirgozliev@gmail.com from the address associated with your account. We aim
to action requests within 30 days.

## Security

- Passwords are hashed with bcrypt and are never stored or transmitted in plain
  text.
- All traffic between the game and the API is encrypted with HTTPS.
- Sign-in is rate limited to slow down password guessing.
- Login sessions expire and can be revoked by signing out.

No system is perfectly secure, but the game deliberately stores as little as
possible so that there is little to lose.

## Children

NexGrid is not directed at children under 13, and we do not knowingly collect
data from them. If you believe a child has created an account, contact us and we
will remove it.

## Changes to this policy

If this policy changes materially, the date at the top will be updated and the
change will be visible in this file's history in the project's public
repository.

## Contact

**Ivan Pirgozliev** — ivanpirgozliev@gmail.com
