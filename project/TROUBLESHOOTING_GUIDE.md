# Troubleshooting Guide - Signup & Game Joining Issues

## 🔧 Issues Fixed

### 1. **Email Validation Issue** ✅
- Simplified email validation to only require `@` symbol
- Reduced password minimum from 8 to 6 characters
- Reduced name minimum from 2 to 1 character

### 2. **User Cannot Join Game Sessions** ✅
- Fixed RLS (Row Level Security) policies
- Improved join_game function with better error handling
- Updated start_game_session to allow game creators to start sessions

---

## 📋 Setup Steps

### Step 1: Apply Database Fixes
Run the entire `supabase-fixes.sql` file in your **Supabase SQL Editor**:

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the entire content from `supabase-fixes.sql`
4. Click **Run** to execute all the fixes

### Step 2: Disable Email Confirmation (Important!)
In your Supabase Dashboard:

1. Go to **Authentication** → **Settings** → **Auth**
2. Scroll down to **Email Auth**
3. **Turn OFF** "Enable email confirmations"
4. Save the settings

OR run this SQL command:
```sql
UPDATE auth.users SET email_confirmed_at = NOW() WHERE email_confirmed_at IS NULL;
```

### Step 3: Create Admin User
After creating a user account, promote them to admin:

```sql
-- Replace 'your-email@domain.com' with actual email
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'your-email@domain.com';
```

---

## 🧪 Testing the Fixes

### Test 1: Signup Process
1. Try registering with simple email format like `test@test`
2. Use password with 6+ characters
3. Should work without email validation errors

### Test 2: Game Creation (Admin)
1. Login as admin user
2. Go to Games tab
3. Create a new game (should appear in inactive state)

### Test 3: Game Session Management
1. **As Admin**: Create a game
2. **As Regular User**: Join the game (should see "Session Not Started")
3. **As Admin**: Start the game session
4. **As Regular User**: Should now see "Join Game" button
5. **As Regular User**: Click "Join Game" (should work without errors)

### Test 4: Spin the Bottle (Admin Only)
1. Create a Spin the Bottle game
2. Have 2+ users join
3. Only admin should see active "Spin the Bottle" button
4. Regular users should see "Admin Required to Spin"

---

## 🔍 Common Issues & Solutions

### Issue: "Email must contain @ symbol"
**Solution**: Make sure you have at least one `@` in the email field. No need for complex email format.

### Issue: "Cannot join game: session is not active"
**Solutions**:
1. Make sure an admin has started the game session
2. Check that the game has minimum 2 players
3. Verify RLS policies were applied correctly

### Issue: "Only administrators can start game sessions"
**Solutions**:
1. Verify user has admin role: `SELECT role FROM profiles WHERE email = 'user@email.com';`
2. Update user role: `UPDATE profiles SET role = 'admin' WHERE email = 'user@email.com';`

### Issue: "User must be authenticated to join games"
**Solutions**:
1. Make sure user is logged in
2. Check if session is still valid
3. Try logging out and back in

### Issue: Registration works but no session
**Solutions**:
1. Disable email confirmation in Supabase Auth settings
2. Run: `UPDATE auth.users SET email_confirmed_at = NOW() WHERE email_confirmed_at IS NULL;`

---

## 📊 Verification Queries

Run these in Supabase SQL Editor to verify everything is working:

### Check Functions Exist
```sql
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('join_game', 'leave_game', 'start_game_session', 'end_game_session');
```

### Check User Roles
```sql
SELECT id, email, full_name, role 
FROM public.profiles 
ORDER BY created_at DESC;
```

### Check Game Sessions
```sql
SELECT id, name, type, session_active, created_by, created_at
FROM public.games
ORDER BY created_at DESC;
```

### Check Game Participants
```sql
SELECT gp.*, p.full_name, p.email
FROM public.game_participants gp
JOIN public.profiles p ON gp.user_id = p.id
WHERE gp.is_active = true;
```

---

## 🚨 Emergency Reset

If things get really messed up, run this to reset game data:

```sql
-- WARNING: This will delete all games and participants!
DELETE FROM public.game_participants;
DELETE FROM public.games;

-- Then restart the app and create fresh games
```

---

## 📱 App Usage Flow

### For Regular Users:
1. **Register** with simple email (just needs `@`)
2. **Login** (should work immediately, no email confirmation)
3. **View Games** (only see active sessions)
4. **Join Games** (click "Join Game" for active sessions)
5. **Play Games** (participate in active games)

### For Admins:
1. **All the above, PLUS:**
2. **Create Games** (via Games tab)
3. **Start Sessions** (when minimum players joined)
4. **End Sessions** (stop games)
5. **Spin Bottle** (in Spin the Bottle games)
6. **Manage Games** (via Admin tab)

---

## ✅ Success Indicators

You'll know everything is working when:
- ✅ Users can register with simple emails
- ✅ No email confirmation required
- ✅ Users can join active game sessions
- ✅ Admins can start/stop game sessions
- ✅ Only admins can spin in Spin the Bottle
- ✅ Real-time updates work across devices

---

## 🆘 Still Having Issues?

If you're still experiencing problems:

1. **Check Supabase Logs**: Go to Logs section in Supabase Dashboard
2. **Check Browser Console**: Look for error messages
3. **Verify Database State**: Use the verification queries above
4. **Test with Fresh User**: Create a completely new user account
5. **Check Network**: Make sure app can connect to Supabase

The most common issue is forgetting to disable email confirmation in Supabase Auth settings!