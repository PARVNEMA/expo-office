# Office App — Requirements Document

**Project Title:** OfficeConnect (working name)

**Tech stack (target):**

- Frontend: Expo (Expo managed workflow) + React Native + TypeScript
- Styling: NativeWind (Tailwind-style utility classes for RN)
- Backend / Auth / Realtime / DB: Supabase (Postgres, Auth, Realtime, Storage)

---

## 1. Executive summary

Build a mobile-first office engagement app for employees to authenticate, receive admin broadcasts/notifications, and play lightweight synchronous & asynchronous office games (buzzer, spin-the-bottle, trivia, quick polls, team duels, leaderboard). The app must be modular, easily maintainable, and integrate with a provided base project. Focus is on an extensible architecture using Expo + NativeWind + Supabase.

---

## 2. Goals & success criteria

**Primary goals**

- Secure authentication and role-based access (employee, admin).
- Reliable push notifications for admin messages to all or targeted groups.
- Smooth, low-latency game experiences for small groups (2–50 players) using Supabase Realtime.
- Clean modular code structure so you can plug features into the base project.
- Offline-friendly where feasible (caching, optimistic UI for low-risk actions).

**Success criteria (how we accept each feature)**

- Users can sign up / sign in with email & password . Admins can be seeded or promoted via DB.
- Admin can send push notifications to all active users; users receive them on their devices via Expo push service.
- At least three games implemented (buzzer, spin-the-bottle, trivia) with proper UX, real-time state sync, and a leaderboard.
- Apps follow the modular folder structure described below. Each module is independently testable.

---

## 3. Stakeholders & roles

- **Admin** — create announcements, send push notifications, create/manage games, view analytics.
- **Employee (User)** — authenticate, receive notifications, join games, view leaderboards, edit profile.

---

## 4. High-level features

1. **Authentication & Profiles**

   - Email/password sign up & sign in (Supabase Auth)
   - Profile page: name, department, role, avatar (Supabase Storage)
   - Device registration for push tokens (Expo push token stored in `user_devices` table)

2. **Roles & Permissions**

   - Role-based gates (user / admin )
   - Admin-only screens and protected API operations

3. **Push Notifications & Announcements**

   - Admin can write an announcement and push to:

     - All users
     - Department(s)
     - Custom segments (e.g., managers only)

   - Scheduling (optional): send now or schedule later
   - Notification history and read receipts (optional)

4. **Games module**
   Core games to include initially (each game is a modular feature with UI, game logic, and realtime sync):

   - Buzzer (fastest-finger): host starts round, players press buzzer; the first press wins the round. Realtime ordering and anti-cheat measures (timestamp + server sequence).
   - Spin the Bottle: host starts spinner; bottle animation runs client-side with server-chosen seed to ensure consistent result; selects a user; optional question prompt.
   - Trivia (multiplayer): admin/host creates trivia room with N questions; players answer within time limit; scoreboard updates in realtime.

   Additional recommended games:

   - Quick Polls / Icebreakers — one-question polls, results update live.
   - Team Duels — 1v1 rapid quiz.
   - Scavenger Hunt (photo-based tasks) — async play, uploads to Supabase Storage, moderated.

5. **Lobby & Rooms**

   - Public and private rooms for games
   - Room invite links or QR codes
   - Room chat (text) — ephemeral or persisted

6. **Leaderboards & Stats**

   - Per-game leaderboards, global leaderboard
   - User profiles show points/badges
   - Admin analytics: number of active users, sessions, top games

7. **Admin Panel (mobile + admin web optional)**

   - Create announcements, manage games, view analytics, moderate content

8. **Settings & Support**

   - Notification preferences, logout, delete device token
   - Help & FAQ, contact admin

---

## 5. Non-functional requirements

- **Security:** Use Supabase row-level security (RLS). All sensitive calls go through server-validated rules or signed endpoints. Use HTTPS everywhere; never embed secrets in the client.
- **Scalability:** Design Realtime rooms to handle 2–100 concurrent users; for heavier use, recommend introducing a lightweight server or Redis later.
- **Resilience:** Cache last announcements locally; handle intermittent connectivity gracefully.
- **Accessibility:** Use accessible contrast, labels, and touch targets; support dynamic type sizes.
- **Maintainability:** Strict code modules, clear API schema, TypeScript types, Zod validation.

---

## 7. Realtime & synchronization strategy

- Use Supabase Realtime (Postgres changes over websockets) for small-scale synchronization: rooms, participant lists, game state updates.
- Keep critical ordering server-authoritative. For example, when a user presses the buzzer:

  1. Client sends `buzzer_press` row insert/update to `game_events` table with timestamp.
  2. Supabase emits the change to the host and other clients; clients use database-seen order + server timestamp to decide the winner.

- For animation deterministic results (e.g., spin-the-bottle), server will generate a pseudo-random seed stored in `games.state.seed` and clients will use same seed to play animation locally.
- For ephemeral low-latency needs, Supabase should suffice for MVP. If latency proves problematic, add a small Node.js socket server later.

---

## 8. Push notifications

- Use Expo Push Notifications. Flow:

  1. On sign-in, the client asks for push permission and obtains Expo push token.
  2. Client saves token to `user_devices` via Supabase.
  3. Admin sends announcement -> serverless function (or a cloud function) queries `user_devices` for tokens matching target and dispatches push via Expo Push API.

- Implementation notes:

  - Keep a server-side secret (Expo push credentials) on a small function in Vercel / Cloudflare Worker / Supabase Edge Function.
  - Alternatively, use Supabase Edge Functions to send pushes.

---

## 10. Navigation & UX

- Use React Navigation (native-stack + bottom tabs).
- Suggested main tabs: Home (announcements + quick join), Games (lobby), Leaderboard, Profile, Admin (if admin user)
- Game flow: Lobby -> Room -> Waiting / Countdown -> Play -> Scoreboard -> End
- Keep animations lightweight; avoid heavy Lottie files unless optimized.

---

## 15. Acceptance criteria (per feature)

- **Auth:** Users sign in/out, update profile, avatar uploads succeed (upload + URL), role-based screens blocked for non-admins.
- **Push:** Admin can create and send a broadcast; >=80% of tokens successfully receive expo response (for acceptance testing environment).
- **Buzzer:** Winner is reliably determined by server timestamp ordering in 95% of tests.
- **Spin the Bottle:** All participating clients show the same target after the spin when using server seed.
- **Trivia:** Scoreboard displays correct cumulative points.

---

## 16. Implementation notes & best practices

- TypeScript everywhere for typesafety.
- Centralized Supabase client in `/lib/supabase.ts` and typed helpers in `/services`.
- Use optimistic updates for UI actions like joining room or casting a vote, but reconcile with server responses.
- Keep UI components small and reusable; follow atomic component idea.
- Use NativeWind for styling and keep a `tailwind.config.js` and design tokens in `/styles`.

---

## 18. Minimal MVP scope (recommended)

1. Auth + profile + push token registration
2. Admin announcement + send to all (no scheduling)
3. Buzzer game (hosted rooms, realtime, winner detection)
4. Lobby and room listing
5. Leaderboard

Add trivia & spin-the-bottle in next increment.

---
