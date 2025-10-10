-- =============================================
-- COMPLETE DATABASE SETUP FOR OFFICECONNECT
-- =============================================
-- Run this ENTIRE script in your Supabase SQL Editor
-- This script includes all tables, functions, policies, and fixes

-- =============================================
-- STEP 1: CREATE ENUMS
-- =============================================

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
-- STEP 2: CREATE TABLES
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
    target_value TEXT,
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
    session_active BOOLEAN DEFAULT false NOT NULL,
    session_started_at TIMESTAMPTZ,
    session_ended_at TIMESTAMPTZ,
    max_players INTEGER,
    min_players INTEGER DEFAULT 2 NOT NULL,
    state JSONB DEFAULT '{"status": "waiting"}' NOT NULL,
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
-- STEP 3: CREATE FUNCTIONS & TRIGGERS
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
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'department'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Could not create profile for user %: %', NEW.id, SQLERRM;
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
-- STEP 4: GAME SESSION MANAGEMENT FUNCTIONS
-- =============================================

-- Function to start a game session (Admin or creator only)
CREATE OR REPLACE FUNCTION public.start_game_session(game_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_user_role user_role;
    participant_count INTEGER;
    min_players_required INTEGER;
    game_creator UUID;
    game_name TEXT;
    is_already_active BOOLEAN;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated';
    END IF;

    SELECT role INTO current_user_role
    FROM public.profiles
    WHERE id = auth.uid();

    SELECT created_by, name, session_active INTO game_creator, game_name, is_already_active
    FROM public.games
    WHERE id = game_id;

    IF is_already_active THEN
        RETURN true;
    END IF;

    IF current_user_role != 'admin' AND game_creator != auth.uid() THEN
        RAISE EXCEPTION 'Only administrators or game creators can start game sessions';
    END IF;

    SELECT g.min_players, COALESCE(COUNT(gp.id), 0)
    INTO min_players_required, participant_count
    FROM public.games g
    LEFT JOIN public.game_participants gp ON g.id = gp.game_id AND gp.is_active = true
    WHERE g.id = game_id
    GROUP BY g.id, g.min_players;

    IF participant_count < min_players_required THEN
        RAISE EXCEPTION 'Cannot start "%" - minimum % players required, currently have % players joined', game_name, min_players_required, participant_count;
    END IF;

    UPDATE public.games
    SET
        session_active = true,
        session_started_at = NOW(),
        session_ended_at = NULL,
        state = COALESCE(state, '{}'::jsonb) || '{"status": "active"}'::jsonb,
        updated_at = NOW()
    WHERE id = game_id;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to end a game session (Admin or creator only)
CREATE OR REPLACE FUNCTION public.end_game_session(game_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_user_role user_role;
    game_creator UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated';
    END IF;

    SELECT role INTO current_user_role
    FROM public.profiles
    WHERE id = auth.uid();

    SELECT created_by INTO game_creator
    FROM public.games
    WHERE id = game_id;

    IF current_user_role != 'admin' AND game_creator != auth.uid() THEN
        RAISE EXCEPTION 'Only administrators or game creators can end game sessions';
    END IF;

    UPDATE public.games
    SET
        session_active = false,
        session_ended_at = NOW(),
        state = state || '{"status": "finished"}'::jsonb,
        updated_at = NOW()
    WHERE id = game_id;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to join a game (users can join inactive games - lobby state)
CREATE OR REPLACE FUNCTION public.join_game(game_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_participants INTEGER;
    max_players_allowed INTEGER;
    is_session_active BOOLEAN;
    user_already_joined BOOLEAN;
    game_exists BOOLEAN;
    is_game_active BOOLEAN;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated to join games';
    END IF;

    SELECT EXISTS(SELECT 1 FROM public.games WHERE id = game_id AND is_active = true) INTO game_exists;
    IF NOT game_exists THEN
        RAISE EXCEPTION 'Game not found or is not active';
    END IF;

    SELECT session_active, max_players, is_active
    INTO is_session_active, max_players_allowed, is_game_active
    FROM public.games
    WHERE id = game_id;

    IF NOT is_game_active THEN
        RAISE EXCEPTION 'Cannot join game: game is not accepting players';
    END IF;

    SELECT EXISTS(
        SELECT 1 FROM public.game_participants
        WHERE game_id = join_game.game_id AND user_id = auth.uid() AND is_active = true
    ) INTO user_already_joined;

    IF user_already_joined THEN
        RETURN true;
    END IF;

    SELECT COUNT(*) INTO current_participants
    FROM public.game_participants
    WHERE game_participants.game_id = join_game.game_id AND is_active = true;

    IF max_players_allowed IS NOT NULL AND current_participants >= max_players_allowed THEN
        RAISE EXCEPTION 'Cannot join game: maximum players reached (% / %)', current_participants, max_players_allowed;
    END IF;

    INSERT INTO public.game_participants (game_id, user_id, is_active, joined_at)
    VALUES (game_id, auth.uid(), true, NOW())
    ON CONFLICT (game_id, user_id)
    DO UPDATE SET
        is_active = true,
        joined_at = NOW();

    RETURN true;

EXCEPTION
    WHEN others THEN
        RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to leave a game
CREATE OR REPLACE FUNCTION public.leave_game(game_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated to leave games';
    END IF;

    UPDATE public.game_participants
    SET is_active = false
    WHERE game_id = leave_game.game_id AND user_id = auth.uid();

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- STEP 5: CREATE VIEW FOR GAMES WITH PARTICIPANTS
-- =============================================

CREATE OR REPLACE VIEW public.games_with_participants AS
SELECT
    g.*,
    COALESCE(p.participant_count, 0) as current_players,
    CASE
        WHEN g.session_active THEN 'active'
        WHEN COALESCE(p.participant_count, 0) >= g.min_players THEN 'ready'
        ELSE 'waiting'
    END as session_status
FROM public.games g
LEFT JOIN (
    SELECT
        game_id,
        COUNT(*) as participant_count
    FROM public.game_participants
    WHERE is_active = true
    GROUP BY game_id
) p ON g.id = p.game_id;

-- =============================================
-- STEP 6: ENABLE ROW LEVEL SECURITY
-- =============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_participants ENABLE ROW LEVEL SECURITY;

-- =============================================
-- STEP 7: CREATE RLS POLICIES
-- =============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can manage their own devices" ON public.user_devices;
DROP POLICY IF EXISTS "Admins can view all devices" ON public.user_devices;
DROP POLICY IF EXISTS "Users can view announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admins can manage announcements" ON public.announcements;
DROP POLICY IF EXISTS "Users can view joinable games" ON public.games;
DROP POLICY IF EXISTS "Users can create games" ON public.games;
DROP POLICY IF EXISTS "Game creators can update their games" ON public.games;
DROP POLICY IF EXISTS "Admins can manage all games" ON public.games;
DROP POLICY IF EXISTS "Users can view game participants" ON public.game_participants;
DROP POLICY IF EXISTS "Users can manage their own game participation" ON public.game_participants;
DROP POLICY IF EXISTS "Game creators can manage participants" ON public.game_participants;

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

-- Games policies
CREATE POLICY "Users can view joinable games" ON public.games
    FOR SELECT USING (
        is_active = true
        OR created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Users can create games" ON public.games
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Game creators can update their games" ON public.games
    FOR UPDATE USING (
        auth.uid() = created_by
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can manage all games" ON public.games
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Allow admins to delete games
CREATE POLICY "Admins and creators can delete games" ON public.games
    FOR DELETE USING (
        auth.uid() = created_by
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Game participants policies
CREATE POLICY "Users can view game participants" ON public.game_participants
    FOR SELECT USING (true);

CREATE POLICY "Users can manage their own game participation" ON public.game_participants
    FOR ALL USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM public.games
            WHERE id = game_id AND created_by = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    )
    WITH CHECK (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM public.games
            WHERE id = game_id AND created_by = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =============================================
-- STEP 8: CREATE INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles(role);
CREATE INDEX IF NOT EXISTS profiles_department_idx ON public.profiles(department);
CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles(email);
CREATE INDEX IF NOT EXISTS user_devices_user_id_idx ON public.user_devices(user_id);
CREATE INDEX IF NOT EXISTS user_devices_active_idx ON public.user_devices(is_active);
CREATE INDEX IF NOT EXISTS announcements_created_by_idx ON public.announcements(created_by);
CREATE INDEX IF NOT EXISTS announcements_target_idx ON public.announcements(target_audience, target_value);
CREATE INDEX IF NOT EXISTS announcements_sent_at_idx ON public.announcements(sent_at);
CREATE INDEX IF NOT EXISTS games_type_idx ON public.games(type);
CREATE INDEX IF NOT EXISTS games_active_idx ON public.games(is_active);
CREATE INDEX IF NOT EXISTS games_created_by_idx ON public.games(created_by);
CREATE INDEX IF NOT EXISTS games_session_active_idx ON public.games(session_active);
CREATE INDEX IF NOT EXISTS games_session_started_idx ON public.games(session_started_at);
CREATE INDEX IF NOT EXISTS games_min_players_idx ON public.games(min_players);
CREATE INDEX IF NOT EXISTS game_participants_game_id_idx ON public.game_participants(game_id);
CREATE INDEX IF NOT EXISTS game_participants_user_id_idx ON public.game_participants(user_id);
CREATE INDEX IF NOT EXISTS game_participants_user_game_active_idx ON public.game_participants(user_id, game_id, is_active);

-- =============================================
-- STEP 9: GRANT PERMISSIONS
-- =============================================

GRANT SELECT ON public.games_with_participants TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_game(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_game(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_game_session(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_game_session(UUID) TO authenticated;

-- =============================================
-- STEP 10: ENABLE REALTIME SUBSCRIPTIONS
-- =============================================

DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.game_participants;
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;
END $$;

-- =============================================
-- STEP 11: CONFIRM ALL EXISTING USERS
-- =============================================

UPDATE auth.users SET email_confirmed_at = NOW() WHERE email_confirmed_at IS NULL;

-- =============================================
-- SUCCESS MESSAGE & NEXT STEPS
-- =============================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '====================================================';
    RAISE NOTICE '✅ DATABASE SETUP COMPLETED SUCCESSFULLY!';
    RAISE NOTICE '====================================================';
    RAISE NOTICE '';
    RAISE NOTICE 'NEXT STEPS:';
    RAISE NOTICE '1. Create an admin user (sign up in the app first, then run):';
    RAISE NOTICE '   UPDATE profiles SET role = ''admin'' WHERE email = ''your-email@domain.com'';';
    RAISE NOTICE '';
    RAISE NOTICE '2. In Supabase Dashboard > Authentication > Settings:';
    RAISE NOTICE '   - Turn OFF "Enable email confirmations"';
    RAISE NOTICE '';
    RAISE NOTICE '3. Test the workflow:';
    RAISE NOTICE '   - Admin creates a game';
    RAISE NOTICE '   - Users can join the game (lobby)';
    RAISE NOTICE '   - When min players joined, admin starts session';
    RAISE NOTICE '   - Users can play the game';
    RAISE NOTICE '   - Admin can end session and delete game';
    RAISE NOTICE '';
    RAISE NOTICE '====================================================';
END $$;
