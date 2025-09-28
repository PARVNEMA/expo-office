-- =============================================
-- FIX GAME JOINING WORKFLOW - Run this in Supabase SQL Editor
-- =============================================
-- This fixes the chicken-and-egg problem where users can't join games 
-- until sessions are active, but admins can't start sessions without enough players

-- =============================================
-- 1. UPDATE GAMES VIEW TO SHOW CORRECT STATUS
-- =============================================

-- Drop and recreate the view with better logic
DROP VIEW IF EXISTS public.games_with_participants;

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

-- Grant permissions to authenticated users
GRANT SELECT ON public.games_with_participants TO authenticated;

-- =============================================
-- 2. UPDATE GAMES RLS POLICY TO ALLOW JOINING INACTIVE GAMES
-- =============================================

-- Drop the overly restrictive policy
DROP POLICY IF EXISTS "Users can view games with active sessions" ON public.games;

-- Create new policy that allows viewing games that:
-- - Have active sessions, OR
-- - User created them, OR 
-- - User is admin, OR
-- - Game is accepting players (not finished)
CREATE POLICY "Users can view joinable games" ON public.games
    FOR SELECT USING (
        session_active = true 
        OR created_by = auth.uid() 
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
        OR (is_active = true AND (state->>'status' != 'finished' OR state->>'status' IS NULL))
    );

-- =============================================
-- 3. IMPROVE JOIN GAME FUNCTION - ALLOW JOINING INACTIVE GAMES
-- =============================================

-- Drop and recreate with better logic
DROP FUNCTION IF EXISTS public.join_game(UUID);

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
    -- Check if user is authenticated
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated to join games';
    END IF;
    
    -- Check if game exists and is active
    SELECT EXISTS(SELECT 1 FROM public.games WHERE id = game_id AND is_active = true) INTO game_exists;
    IF NOT game_exists THEN
        RAISE EXCEPTION 'Game not found or is not active';
    END IF;
    
    -- Get game info
    SELECT session_active, max_players, is_active 
    INTO is_session_active, max_players_allowed, is_game_active
    FROM public.games
    WHERE id = game_id;
    
    -- Allow joining both active and inactive sessions (users can join lobby)
    -- Only prevent joining if game is completely inactive
    IF NOT is_game_active THEN
        RAISE EXCEPTION 'Cannot join game: game is not accepting players';
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
-- 4. IMPROVE START SESSION FUNCTION - BETTER ERROR MESSAGES
-- =============================================

DROP FUNCTION IF EXISTS public.start_game_session(UUID);

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
    -- Check if user is authenticated
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated';
    END IF;
    
    -- Get user role and check permissions
    SELECT role INTO current_user_role 
    FROM public.profiles 
    WHERE id = auth.uid();
    
    -- Get game info
    SELECT created_by, name, session_active INTO game_creator, game_name, is_already_active
    FROM public.games
    WHERE id = game_id;
    
    -- Check if session is already active
    IF is_already_active THEN
        RAISE NOTICE 'Game session is already active';
        RETURN true;
    END IF;
    
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
        RAISE EXCEPTION 'Cannot start "%" - minimum % players required, currently have % players joined', game_name, min_players_required, participant_count;
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
    
    RAISE NOTICE 'Successfully started game session for "%"', game_name;
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 5. CREATE HELPER FUNCTION TO GET GAME LOBBY INFO
-- =============================================

CREATE OR REPLACE FUNCTION public.get_game_lobby_info(game_id UUID)
RETURNS TABLE (
    game_name TEXT,
    game_type game_type,
    current_players INTEGER,
    min_players INTEGER,
    max_players INTEGER,
    session_active BOOLEAN,
    can_start BOOLEAN,
    participants JSON
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.name,
        g.type,
        COALESCE(COUNT(gp.id), 0)::INTEGER as current_players,
        g.min_players,
        g.max_players,
        g.session_active,
        (COALESCE(COUNT(gp.id), 0) >= g.min_players) as can_start,
        COALESCE(
            JSON_AGG(
                JSON_BUILD_OBJECT(
                    'user_id', gp.user_id,
                    'full_name', p.full_name,
                    'email', p.email,
                    'joined_at', gp.joined_at
                )
            ) FILTER (WHERE gp.id IS NOT NULL),
            '[]'::json
        ) as participants
    FROM public.games g
    LEFT JOIN public.game_participants gp ON g.id = gp.game_id AND gp.is_active = true
    LEFT JOIN public.profiles p ON gp.user_id = p.id
    WHERE g.id = get_game_lobby_info.game_id
    GROUP BY g.id, g.name, g.type, g.min_players, g.max_players, g.session_active;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_game_lobby_info(UUID) TO authenticated;

-- =============================================
-- 6. ENSURE REALTIME IS WORKING
-- =============================================

-- Make sure realtime publication includes the view
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.games_with_participants;
    EXCEPTION
        WHEN duplicate_object THEN NULL;
        WHEN others THEN 
            RAISE NOTICE 'Could not add games_with_participants to realtime: %', SQLERRM;
    END;
END $$;

-- =============================================
-- 7. GRANT ALL NECESSARY PERMISSIONS
-- =============================================

GRANT EXECUTE ON FUNCTION public.join_game(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_game_session(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_game_lobby_info(UUID) TO authenticated;

-- =============================================
-- TESTING QUERIES
-- =============================================

-- Test 1: Check current games and participants
SELECT 
    g.name,
    g.type,
    g.session_active,
    g.min_players,
    COALESCE(COUNT(gp.id), 0) as current_players
FROM public.games g
LEFT JOIN public.game_participants gp ON g.id = gp.game_id AND gp.is_active = true
GROUP BY g.id, g.name, g.type, g.session_active, g.min_players
ORDER BY g.created_at DESC;

-- Test 2: Check if functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('join_game', 'start_game_session', 'get_game_lobby_info');

-- =============================================
-- SUCCESS MESSAGE
-- =============================================
DO $$
BEGIN
    RAISE NOTICE '✅ Game workflow fixes applied successfully!';
    RAISE NOTICE '';
    RAISE NOTICE 'NEW WORKFLOW:';
    RAISE NOTICE '1. Admin/User creates a game (inactive session)';
    RAISE NOTICE '2. Users can now JOIN the game (lobby state)';
    RAISE NOTICE '3. Once minimum players joined, admin can START session';
    RAISE NOTICE '4. Game becomes fully active for gameplay';
    RAISE NOTICE '';
    RAISE NOTICE 'Users can now join games BEFORE sessions are started!';
END $$;