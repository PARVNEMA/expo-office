-- =============================================
-- Game Session Management Update
-- =============================================
-- Run this SQL in Supabase to add session management to games

-- Add new columns to games table for session management
ALTER TABLE public.games 
ADD COLUMN IF NOT EXISTS session_active BOOLEAN DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS session_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS session_ended_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS min_players INTEGER DEFAULT 2 NOT NULL;

-- Update the state JSONB to have a default game status
UPDATE public.games 
SET state = COALESCE(state, '{}'::jsonb) || '{"status": "waiting"}'::jsonb 
WHERE state IS NULL OR NOT (state ? 'status');

-- Create enum for game session status
DO $$ BEGIN
    CREATE TYPE game_session_status AS ENUM ('waiting', 'active', 'paused', 'finished');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =============================================
-- Update RLS Policies for Session Management
-- =============================================

-- Drop and recreate games policies with session visibility
DROP POLICY IF EXISTS "Users can view active games" ON public.games;

-- Only show games that have active sessions OR are created by the current user OR user is admin
CREATE POLICY "Users can view games with active sessions" ON public.games
    FOR SELECT USING (
        session_active = true 
        OR created_by = auth.uid() 
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Only admins and game creators can start sessions
CREATE POLICY "Admins and creators can manage game sessions" ON public.games
    FOR UPDATE USING (
        created_by = auth.uid() 
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =============================================
-- Game Session Management Functions
-- =============================================

-- Function to start a game session (only admin can start)
CREATE OR REPLACE FUNCTION public.start_game_session(game_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_user_role user_role;
    participant_count INTEGER;
    min_players_required INTEGER;
BEGIN
    -- Check if user is admin
    SELECT role INTO current_user_role 
    FROM public.profiles 
    WHERE id = auth.uid();
    
    IF current_user_role != 'admin' THEN
        RAISE EXCEPTION 'Only administrators can start game sessions';
    END IF;
    
    -- Get minimum players required and current participant count
    SELECT g.min_players, COUNT(gp.id) INTO min_players_required, participant_count
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
        state = state || '{"status": "active"}'::jsonb,
        updated_at = NOW()
    WHERE id = game_id;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to end a game session (only admin or game creator)
CREATE OR REPLACE FUNCTION public.end_game_session(game_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_user_role user_role;
    game_creator UUID;
BEGIN
    -- Get user role and game creator
    SELECT role INTO current_user_role 
    FROM public.profiles 
    WHERE id = auth.uid();
    
    SELECT created_by INTO game_creator
    FROM public.games
    WHERE id = game_id;
    
    -- Check if user is admin or game creator
    IF current_user_role != 'admin' AND game_creator != auth.uid() THEN
        RAISE EXCEPTION 'Only administrators or game creators can end game sessions';
    END IF;
    
    -- End the session
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

-- Function to join a game (must have active session and not be full)
CREATE OR REPLACE FUNCTION public.join_game(game_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_participants INTEGER;
    max_players_allowed INTEGER;
    is_session_active BOOLEAN;
    user_already_joined BOOLEAN;
BEGIN
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
        RAISE EXCEPTION 'User is already participating in this game';
    END IF;
    
    -- Check participant count
    SELECT COUNT(*) INTO current_participants
    FROM public.game_participants
    WHERE game_participants.game_id = join_game.game_id AND is_active = true;
    
    IF max_players_allowed IS NOT NULL AND current_participants >= max_players_allowed THEN
        RAISE EXCEPTION 'Cannot join game: maximum players reached';
    END IF;
    
    -- Add user to game
    INSERT INTO public.game_participants (game_id, user_id)
    VALUES (game_id, auth.uid())
    ON CONFLICT (game_id, user_id) 
    DO UPDATE SET is_active = true, joined_at = NOW();
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to leave a game
CREATE OR REPLACE FUNCTION public.leave_game(game_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.game_participants 
    SET is_active = false
    WHERE game_id = leave_game.game_id AND user_id = auth.uid();
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- Views for easier querying
-- =============================================

-- Create view for games with participant counts
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS games_session_active_idx ON public.games(session_active);
CREATE INDEX IF NOT EXISTS games_session_started_idx ON public.games(session_started_at);
CREATE INDEX IF NOT EXISTS games_min_players_idx ON public.games(min_players);

-- Enable realtime for the view (optional)
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.games_with_participants;

-- =============================================
-- Sample Admin User Setup (Run manually if needed)
-- =============================================
-- Make sure you have an admin user. If you need to create one:
-- 1. First create the user in Supabase Auth Dashboard
-- 2. Then run this to make them admin:
/*
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'your-admin-email@company.com';
*/