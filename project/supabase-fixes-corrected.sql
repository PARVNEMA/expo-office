-- =============================================
-- SUPABASE FIXES - CORRECTED VERSION
-- Run this in Supabase SQL Editor
-- =============================================

-- =============================================
-- 1. FIX EMAIL CONFIRMATION ISSUE
-- =============================================
-- Disable email confirmation requirement (Run this in Supabase Dashboard)
-- Go to Authentication > Settings > Email Auth
-- Turn OFF "Enable email confirmations"
-- OR run this to confirm all existing users:
UPDATE auth.users SET email_confirmed_at = NOW() WHERE email_confirmed_at IS NULL;

-- =============================================
-- 2. FIX SESSION JOINING ISSUES
-- =============================================

-- Update RLS policies to allow users to join games properly
DROP POLICY IF EXISTS "Users can join/leave games" ON public.game_participants;
DROP POLICY IF EXISTS "Users can update their own participation" ON public.game_participants;

-- More permissive policy for joining games
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
-- 3. IMPROVED JOIN GAME FUNCTION
-- =============================================

-- Drop and recreate the join_game function with better error handling
DROP FUNCTION IF EXISTS public.join_game(UUID);

CREATE OR REPLACE FUNCTION public.join_game(game_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_participants INTEGER;
    max_players_allowed INTEGER;
    is_session_active BOOLEAN;
    user_already_joined BOOLEAN;
    game_exists BOOLEAN;
BEGIN
    -- Check if user is authenticated
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated to join games';
    END IF;
    
    -- Check if game exists
    SELECT EXISTS(SELECT 1 FROM public.games WHERE id = game_id) INTO game_exists;
    IF NOT game_exists THEN
        RAISE EXCEPTION 'Game not found';
    END IF;
    
    -- Check if game session is active
    SELECT session_active, max_players INTO is_session_active, max_players_allowed
    FROM public.games
    WHERE id = game_id;
    
    IF NOT is_session_active THEN
        RAISE EXCEPTION 'Cannot join game: session is not active';
    END IF;
    
    -- Check if user is already in the game
    SELECT EXISTS(
        SELECT 1 FROM public.game_participants 
        WHERE game_id = join_game.game_id AND user_id = auth.uid() AND is_active = true
    ) INTO user_already_joined;
    
    IF user_already_joined THEN
        -- User is already in the game, just return true
        RETURN true;
    END IF;
    
    -- Check participant count
    SELECT COUNT(*) INTO current_participants
    FROM public.game_participants
    WHERE game_participants.game_id = join_game.game_id AND is_active = true;
    
    IF max_players_allowed IS NOT NULL AND current_participants >= max_players_allowed THEN
        RAISE EXCEPTION 'Cannot join game: maximum players reached (% / %)', current_participants, max_players_allowed;
    END IF;
    
    -- Add user to game or reactivate existing participation
    INSERT INTO public.game_participants (game_id, user_id, is_active, joined_at)
    VALUES (game_id, auth.uid(), true, NOW())
    ON CONFLICT (game_id, user_id) 
    DO UPDATE SET 
        is_active = true, 
        joined_at = NOW();
    
    RETURN true;
    
EXCEPTION
    WHEN others THEN
        -- Log the error for debugging
        RAISE NOTICE 'Error in join_game: %', SQLERRM;
        RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 4. IMPROVED LEAVE GAME FUNCTION
-- =============================================

DROP FUNCTION IF EXISTS public.leave_game(UUID);

CREATE OR REPLACE FUNCTION public.leave_game(game_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if user is authenticated
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated to leave games';
    END IF;
    
    -- Update participation status
    UPDATE public.game_participants 
    SET is_active = false
    WHERE game_id = leave_game.game_id AND user_id = auth.uid();
    
    -- Return true even if no rows were updated (user wasn't in game)
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 5. IMPROVED START SESSION FUNCTION
-- =============================================

DROP FUNCTION IF EXISTS public.start_game_session(UUID);

CREATE OR REPLACE FUNCTION public.start_game_session(game_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_user_role user_role;
    participant_count INTEGER;
    min_players_required INTEGER;
    game_creator UUID;
BEGIN
    -- Check if user is authenticated
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated';
    END IF;
    
    -- Get user role and check permissions
    SELECT role INTO current_user_role 
    FROM public.profiles 
    WHERE id = auth.uid();
    
    -- Get game creator
    SELECT created_by INTO game_creator
    FROM public.games
    WHERE id = game_id;
    
    -- Check if user is admin OR game creator
    IF current_user_role != 'admin' AND game_creator != auth.uid() THEN
        RAISE EXCEPTION 'Only administrators or game creators can start game sessions';
    END IF;
    
    -- Get minimum players required and current participant count
    SELECT g.min_players, COALESCE(COUNT(gp.id), 0) 
    INTO min_players_required, participant_count
    FROM public.games g
    LEFT JOIN public.game_participants gp ON g.id = gp.game_id AND gp.is_active = true
    WHERE g.id = game_id
    GROUP BY g.id, g.min_players;
    
    -- Check if minimum players requirement is met
    IF participant_count < min_players_required THEN
        RAISE EXCEPTION 'Cannot start game: minimum % players required, currently have %', min_players_required, participant_count;
    END IF;
    
    -- Start the session
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

-- =============================================
-- 6. FIX PROFILE CREATION TRIGGER (HANDLE DEPENDENCIES)
-- =============================================

-- First drop the trigger, then the function, then recreate both
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Now we can safely drop and recreate the function
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert profile, ignore conflicts to prevent duplicate key errors
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
        -- Log the error but don't fail the auth user creation
        RAISE NOTICE 'Could not create profile for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- 7. ENSURE PROPER INDEXES
-- =============================================

-- Make sure we have proper indexes for performance
CREATE INDEX IF NOT EXISTS game_participants_user_game_active_idx ON public.game_participants(user_id, game_id, is_active);
CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles(email);

-- =============================================
-- 8. GRANT PROPER PERMISSIONS
-- =============================================

-- Ensure authenticated users can call the functions
GRANT EXECUTE ON FUNCTION public.join_game(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_game(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_game_session(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_game_session(UUID) TO authenticated;

-- =============================================
-- 9. CREATE A TEST USER (OPTIONAL)
-- =============================================
-- Uncomment and modify to create test users if needed

/*
-- Insert a test admin user (replace with actual email/ID)
INSERT INTO public.profiles (id, email, full_name, role, department) 
VALUES (
    gen_random_uuid(),  -- Replace with actual user UUID from auth.users
    'admin@test.com',
    'Admin User',
    'admin',
    'IT'
) ON CONFLICT (email) DO UPDATE SET role = 'admin';
*/

-- =============================================
-- 10. REALTIME SETUP
-- =============================================

-- Make sure realtime is enabled for the tables
DO $$
BEGIN
    -- Add tables to realtime publication, ignore if already exists
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
END $$;

-- =============================================
-- VERIFICATION QUERIES (Run these to test)
-- =============================================

-- Check if functions exist
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('join_game', 'leave_game', 'start_game_session', 'end_game_session');

-- Check RLS policies
SELECT schemaname, tablename, policyname, cmd, roles 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('games', 'game_participants', 'profiles');

-- Check if realtime is enabled
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';

-- Check if trigger was recreated
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- =============================================
-- SUCCESS MESSAGE
-- =============================================
DO $$
BEGIN
    RAISE NOTICE '✅ Supabase fixes applied successfully!';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Disable email confirmation in Supabase Auth settings';
    RAISE NOTICE '2. Create an admin user: UPDATE profiles SET role = ''admin'' WHERE email = ''your-email@domain.com''';
    RAISE NOTICE '3. Test signup with simple email like test@test';
    RAISE NOTICE '4. Test game joining as regular user';
END $$;