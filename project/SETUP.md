# OfficeConnect Setup Guide

This guide will help you set up the OfficeConnect app with Supabase authentication and role-based access control.

## Prerequisites

- Node.js (v18 or higher)
- Expo CLI (`npm install -g @expo/cli`)
- A Supabase account (free tier available at [supabase.com](https://supabase.com))

## Step 1: Supabase Setup

### 1.1 Create a new Supabase project
1. Go to [app.supabase.com](https://app.supabase.com)
2. Click "New Project"
3. Choose your organization and enter project details
4. Wait for the project to be created

### 1.2 Get your project credentials
1. Go to Settings > API
2. Copy your project URL and anon key
3. You'll need these for the `.env` file

### 1.3 Set up the database schema
1. Go to the SQL Editor in your Supabase dashboard
2. Copy the contents of `supabase-schema.sql`
3. Paste and run the SQL to create all tables, policies, and functions

## Step 2: Environment Configuration

### 2.1 Create environment file
```bash
cp .env.example .env
```

### 2.2 Update environment variables
Edit `.env` and add your Supabase credentials:
```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Step 3: Install Dependencies

```bash
npm install
```

## Step 4: Create Your First Admin User

### 4.1 Disable email confirmation (for development)
1. Go to Authentication > Settings in Supabase
2. Turn off "Enable email confirmations"
3. This makes testing easier during development

### 4.2 Create admin account through the app
1. Start the development server: `npm run dev`
2. Open the app and register a new account
3. The profile will be created automatically with role 'user'

### 4.3 Update the user role to admin
1. Go to Table Editor > profiles in Supabase
2. Find your user and edit the role field to 'admin'
3. Now you'll have access to the admin panel

## Step 5: Test the Application

### 5.1 Start the development server
```bash
npm run dev
```

### 5.2 Test authentication flows
- Register a new user account
- Login with existing credentials
- Test role-based access (admin panel should only be visible to admin users)

### 5.3 Test role-based features
- Login as admin user - should see Admin tab in navigation
- Login as regular user - should not see Admin tab
- Admin users have access to all features in the admin panel

## Step 6: Enable Row Level Security (RLS)

The schema automatically sets up RLS policies, but verify they're working:

1. Go to Table Editor in Supabase
2. Check that each table shows "RLS enabled"
3. Test that users can only access their own data

## Database Schema Overview

The app creates the following tables:

- **profiles**: User profiles with role-based access
- **user_devices**: Device registration for push notifications
- **announcements**: Admin announcements to users
- **games**: Office games and activities
- **game_participants**: User participation in games

## Role-Based Permissions

### Admin Role
- Can create and send announcements
- Can manage all games
- Can view analytics
- Can manage user accounts
- Has full access to admin panel

### User Role
- Can participate in games
- Can view announcements
- Can update their own profile
- Cannot access admin features

## Security Features

- **Row Level Security (RLS)**: Database-level security policies
- **JWT Authentication**: Secure token-based authentication
- **Role-based Access Control**: UI and API-level permission checks
- **Automatic Profile Creation**: Profiles created on user registration
- **Secure Token Refresh**: Automatic session management

## Development Tips

### Adding New Admin Users
To promote a user to admin:
```sql
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'user@example.com';
```

### Testing Role Changes
- Log out and log back in after role changes
- Role changes are reflected immediately in the UI

### Debugging Authentication
- Check browser console for auth errors
- Verify Supabase credentials in `.env`
- Check if tables and policies are created correctly

## Next Steps

After setup, you can start building additional features:

1. **Push Notifications**: Implement Expo push notifications
2. **Real-time Games**: Use Supabase Realtime for live game features
3. **File Uploads**: Add avatar uploads using Supabase Storage
4. **Analytics**: Implement admin analytics dashboard

## Troubleshooting

### Common Issues

**"Missing Supabase environment variables"**
- Check that `.env` file exists and has correct variables
- Ensure variables start with `EXPO_PUBLIC_`

**"Auth user not found"**
- Make sure the user exists in auth.users table
- Check if the profile was created in the profiles table

**"Permission denied"**
- Verify RLS policies are enabled
- Check user role in profiles table
- Ensure admin users have correct permissions

**"Invalid login response"**
- Check email/password are correct
- Verify user exists and is confirmed in Supabase Auth

For more help, check the [Supabase documentation](https://supabase.com/docs) or the [Expo documentation](https://docs.expo.dev/).