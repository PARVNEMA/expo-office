# Database Setup Instructions

## Step 1: Apply the Database Schema

1. Go to your Supabase project dashboard: https://app.supabase.com/
2. Navigate to the **SQL Editor**
3. Copy the entire contents of `supabase-schema.sql`
4. Paste it into the SQL Editor and run it
5. This will create all tables, policies, triggers, and functions

## Step 2: Verify the Schema

After running the schema, verify these tables were created:
- ✅ `profiles` - User profiles with role-based access
- ✅ `user_devices` - Device registration for push notifications  
- ✅ `announcements` - Admin announcements
- ✅ `games` - Office games and activities
- ✅ `game_participants` - User participation in games

## Step 3: Check Row Level Security (RLS)

1. Go to **Table Editor** in Supabase
2. Verify each table shows "RLS enabled"
3. Check the **Authentication** > **Policies** section to see all security policies

## Step 4: Test Authentication

1. Run the app: `npm run dev`
2. Register a new account - profile will be created automatically as 'user' role
3. To test admin features:
   - Go to **Table Editor** > **profiles** in Supabase
   - Find your user and edit the role field to 'admin'
   - Log out and log back in to see the Admin tab

## Schema Features

### Security Features:
- **Row Level Security (RLS)**: Database-level security policies
- **JWT Authentication**: Secure token-based authentication  
- **Role-based Access Control**: UI and API-level permission checks
- **Automatic Profile Creation**: Profiles created on user registration
- **Secure Token Refresh**: Automatic session management

### Role-Based Permissions:

**Admin Role:**
- Can create and send announcements
- Can manage all games
- Can view analytics
- Can manage user accounts
- Has full access to admin panel

**User Role:**
- Can participate in games
- Can view announcements
- Can update their own profile
- Cannot access admin features

## Troubleshooting

If you encounter issues:

1. **"Missing Supabase environment variables"**
   - Check that `.env` file exists and has correct variables
   - Ensure variables start with `EXPO_PUBLIC_`

2. **"Auth user not found"**
   - Make sure the user exists in auth.users table
   - Check if the profile was created in the profiles table

3. **"Permission denied"**
   - Verify RLS policies are enabled
   - Check user role in profiles table

## Next Development Steps

After authentication is working:
1. **Push Notifications**: Implement Expo push notifications
2. **Real-time Games**: Use Supabase Realtime for live game features  
3. **File Uploads**: Add avatar uploads using Supabase Storage
4. **Analytics**: Implement admin analytics dashboard