-- =============================================
-- Supabase Database Schema for OfficeConnect
-- =============================================
-- Run this in your Supabase SQL Editor to set up the database

-- =============================================
-- ENUMS (Create these first)
-- =============================================

-- Create custom types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('user', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE game_type AS ENUM ('buzzer', 'trivia', 'spin_bottle', 'poll');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE target_audience AS ENUM ('all', 'department', 'role');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =============================================
-- TABLES
-- =============================================

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    role user_role DEFAULT 'user' NOT NULL,
    department TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- User devices table (for push notifications)
CREATE TABLE IF NOT EXISTS public.user_devices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    expo_push_token TEXT NOT NULL UNIQUE,
    device_name TEXT,
    device_type TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Announcements table
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    target_audience target_audience DEFAULT 'all' NOT NULL,
    target_value TEXT, -- department name or role name when target_audience is not 'all'
    scheduled_for TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Games table
CREATE TABLE IF NOT EXISTS public.games (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    type game_type NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    max_players INTEGER,
    state JSONB DEFAULT '{}' NOT NULL, -- Game-specific state (settings, current round, etc.)
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Game participants table
CREATE TABLE IF NOT EXISTS public.game_participants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    game_id UUID REFERENCES public.games(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    score INTEGER DEFAULT 0 NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    UNIQUE(game_id, user_id)
);

-- =============================================
-- FUNCTIONS & TRIGGERS
-- =============================================

-- Function to handle updated_at timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, department)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        NEW.raw_user_meta_data->>'department'
    );
    RETURN NEW;
EXCEPTION
    WHEN others THEN
        -- If there's any error, still return NEW to allow auth user creation
        RAISE WARNING 'Could not create profile for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_user_devices_updated_at ON public.user_devices;
DROP TRIGGER IF EXISTS update_announcements_updated_at ON public.announcements;
DROP TRIGGER IF EXISTS update_games_updated_at ON public.games;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_user_devices_updated_at
    BEFORE UPDATE ON public.user_devices
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_announcements_updated_at
    BEFORE UPDATE ON public.announcements
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_games_updated_at
    BEFORE UPDATE ON public.games
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Trigger to create profile on auth.users insert
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_participants ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can update any profile" ON public.profiles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Drop existing policies if they exist (User devices)
DROP POLICY IF EXISTS "Users can manage their own devices" ON public.user_devices;
DROP POLICY IF EXISTS "Admins can view all devices" ON public.user_devices;

-- User devices policies
CREATE POLICY "Users can manage their own devices" ON public.user_devices
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all devices" ON public.user_devices
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Drop existing policies if they exist (Announcements)
DROP POLICY IF EXISTS "Users can view announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admins can manage announcements" ON public.announcements;

-- Announcements policies
CREATE POLICY "Users can view announcements" ON public.announcements
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage announcements" ON public.announcements
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Drop existing policies if they exist (Games)
DROP POLICY IF EXISTS "Users can view active games" ON public.games;
DROP POLICY IF EXISTS "Users can create games" ON public.games;
DROP POLICY IF EXISTS "Game creators can update their games" ON public.games;
DROP POLICY IF EXISTS "Admins can manage all games" ON public.games;

-- Games policies
CREATE POLICY "Users can view active games" ON public.games
    FOR SELECT USING (is_active = true);

CREATE POLICY "Users can create games" ON public.games
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Game creators can update their games" ON public.games
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Admins can manage all games" ON public.games
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Drop existing policies if they exist (Game participants)
DROP POLICY IF EXISTS "Users can view game participants" ON public.game_participants;
DROP POLICY IF EXISTS "Users can join/leave games" ON public.game_participants;
DROP POLICY IF EXISTS "Users can update their own participation" ON public.game_participants;
DROP POLICY IF EXISTS "Game creators can manage participants" ON public.game_participants;

-- Game participants policies
CREATE POLICY "Users can view game participants" ON public.game_participants
    FOR SELECT USING (true);

CREATE POLICY "Users can join/leave games" ON public.game_participants
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own participation" ON public.game_participants
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Game creators can manage participants" ON public.game_participants
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.games 
            WHERE id = game_id AND created_by = auth.uid()
        )
    );

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles(role);
CREATE INDEX IF NOT EXISTS profiles_department_idx ON public.profiles(department);

-- User devices indexes
CREATE INDEX IF NOT EXISTS user_devices_user_id_idx ON public.user_devices(user_id);
CREATE INDEX IF NOT EXISTS user_devices_active_idx ON public.user_devices(is_active);

-- Announcements indexes
CREATE INDEX IF NOT EXISTS announcements_created_by_idx ON public.announcements(created_by);
CREATE INDEX IF NOT EXISTS announcements_target_idx ON public.announcements(target_audience, target_value);
CREATE INDEX IF NOT EXISTS announcements_sent_at_idx ON public.announcements(sent_at);

-- Games indexes
CREATE INDEX IF NOT EXISTS games_type_idx ON public.games(type);
CREATE INDEX IF NOT EXISTS games_active_idx ON public.games(is_active);
CREATE INDEX IF NOT EXISTS games_created_by_idx ON public.games(created_by);

-- Game participants indexes
CREATE INDEX IF NOT EXISTS game_participants_game_id_idx ON public.game_participants(game_id);
CREATE INDEX IF NOT EXISTS game_participants_user_id_idx ON public.game_participants(user_id);

-- =============================================
-- SAMPLE DATA (Optional - for testing)
-- =============================================

-- Insert a sample admin user (you'll need to create this user in Supabase Auth first)
-- Replace 'your-admin-uuid' with the actual UUID from auth.users
-- INSERT INTO public.profiles (id, email, full_name, role, department) 
-- VALUES (
--     'your-admin-uuid',
--     'admin@yourcompany.com',
--     'Admin User',
--     'admin',
--     'IT'
-- );

-- =============================================
-- REALTIME SUBSCRIPTIONS
-- =============================================

-- Enable realtime for tables that need live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;

-- Note: After running this schema, you'll need to:
-- 1. Create your first admin user through Supabase Auth
-- 2. Update their profile role to 'admin' in the profiles table
-- 3. Configure your Expo app with the Supabase URL and anon key
-- 4. Test the authentication flow