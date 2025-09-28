import { supabase } from '@/lib/supabase';
import { Database } from '@/types/supabase.types';

export type GameType = 'buzzer' | 'trivia' | 'spin_bottle' | 'poll';

export interface Game {
  id: string;
  name: string;
  type: GameType;
  created_by: string;
  is_active: boolean;
  session_active: boolean;
  session_started_at?: string;
  session_ended_at?: string;
  max_players?: number;
  min_players: number;
  current_players: number;
  session_status: 'waiting' | 'ready' | 'active' | 'finished';
  state: any;
  created_at: string;
  updated_at: string;
}

export interface GameParticipant {
  id: string;
  game_id: string;
  user_id: string;
  joined_at: string;
  score: number;
  is_active: boolean;
  profile?: {
    full_name: string;
    email: string;
    avatar_url?: string;
  };
}

export interface CreateGameData {
  name: string;
  type: GameType;
  max_players?: number;
  min_players?: number;
  state?: any;
}

export class GameService {
  // =============================================
  // Game CRUD Operations
  // =============================================
  
  /**
   * Get all visible games (with active sessions or created by user or if user is admin)
   */
  static async getGames(): Promise<Game[]> {
    const { data, error } = await supabase
      .from('games_with_participants')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching games:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get a specific game by ID
   */
  static async getGame(gameId: string): Promise<Game | null> {
    const { data, error } = await supabase
      .from('games_with_participants')
      .select('*')
      .eq('id', gameId)
      .single();

    if (error) {
      console.error('Error fetching game:', error);
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return data;
  }

  /**
   * Create a new game
   */
  static async createGame(gameData: CreateGameData): Promise<Game> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const gamePayload = {
      name: gameData.name,
      type: gameData.type,
      created_by: user.id,
      max_players: gameData.max_players,
      min_players: gameData.min_players || 2,
      state: gameData.state || { status: 'waiting' },
      is_active: true,
    };

    const { data, error } = await supabase
      .from('games')
      .insert([gamePayload])
      .select()
      .single();

    if (error) {
      console.error('Error creating game:', error);
      throw error;
    }

    // Return the created game with participant count
    const createdGame = await this.getGame(data.id);
    if (!createdGame) throw new Error('Failed to fetch created game');
    
    return createdGame;
  }

  /**
   * Update a game (only creator or admin)
   */
  static async updateGame(gameId: string, updates: Partial<Database['public']['Tables']['games']['Update']>): Promise<Game> {
    const { data, error } = await supabase
      .from('games')
      .update(updates)
      .eq('id', gameId)
      .select()
      .single();

    if (error) {
      console.error('Error updating game:', error);
      throw error;
    }

    const updatedGame = await this.getGame(gameId);
    if (!updatedGame) throw new Error('Failed to fetch updated game');
    
    return updatedGame;
  }

  /**
   * Delete a game (only creator or admin)
   */
  static async deleteGame(gameId: string): Promise<boolean> {
    const { error } = await supabase
      .from('games')
      .delete()
      .eq('id', gameId);

    if (error) {
      console.error('Error deleting game:', error);
      throw error;
    }

    return true;
  }

  // =============================================
  // Session Management (Admin Only)
  // =============================================

  /**
   * Start a game session (Admin only)
   */
  static async startGameSession(gameId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('start_game_session', {
        game_id: gameId
      });

      if (error) {
        console.error('Error starting game session:', error);
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      console.error('Error starting game session:', error);
      throw error;
    }
  }

  /**
   * End a game session (Admin or creator only)
   */
  static async endGameSession(gameId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('end_game_session', {
        game_id: gameId
      });

      if (error) {
        console.error('Error ending game session:', error);
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      console.error('Error ending game session:', error);
      throw error;
    }
  }

  // =============================================
  // Participant Management
  // =============================================

  /**
   * Join a game
   */
  static async joinGame(gameId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('join_game', {
        game_id: gameId
      });

      if (error) {
        console.error('Error joining game:', error);
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      console.error('Error joining game:', error);
      throw error;
    }
  }

  /**
   * Leave a game
   */
  static async leaveGame(gameId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('leave_game', {
        game_id: gameId
      });

      if (error) {
        console.error('Error leaving game:', error);
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      console.error('Error leaving game:', error);
      throw error;
    }
  }

  /**
   * Get game participants
   */
  static async getGameParticipants(gameId: string): Promise<GameParticipant[]> {
    const { data, error } = await supabase
      .from('game_participants')
      .select(`
        *,
        profile:profiles(
          full_name,
          email,
          avatar_url
        )
      `)
      .eq('game_id', gameId)
      .eq('is_active', true)
      .order('joined_at', { ascending: true });

    if (error) {
      console.error('Error fetching game participants:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Update participant score
   */
  static async updateParticipantScore(gameId: string, userId: string, score: number): Promise<boolean> {
    const { error } = await supabase
      .from('game_participants')
      .update({ score })
      .eq('game_id', gameId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating participant score:', error);
      throw error;
    }

    return true;
  }

  /**
   * Remove participant (admin/creator only)
   */
  static async removeParticipant(gameId: string, userId: string): Promise<boolean> {
    const { error } = await supabase
      .from('game_participants')
      .update({ is_active: false })
      .eq('game_id', gameId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error removing participant:', error);
      throw error;
    }

    return true;
  }

  // =============================================
  // Game State Management
  // =============================================

  /**
   * Update game state (for game logic)
   */
  static async updateGameState(gameId: string, stateUpdate: any): Promise<boolean> {
    const currentGame = await this.getGame(gameId);
    if (!currentGame) throw new Error('Game not found');

    const newState = { ...currentGame.state, ...stateUpdate };

    const { error } = await supabase
      .from('games')
      .update({ state: newState })
      .eq('id', gameId);

    if (error) {
      console.error('Error updating game state:', error);
      throw error;
    }

    return true;
  }

  // =============================================
  // Real-time Subscriptions
  // =============================================

  /**
   * Subscribe to game changes
   */
  static subscribeToGameChanges(gameId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`game-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        callback
      )
      .subscribe();
  }

  /**
   * Subscribe to game participant changes
   */
  static subscribeToParticipantChanges(gameId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`participants-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_participants',
          filter: `game_id=eq.${gameId}`,
        },
        callback
      )
      .subscribe();
  }

  /**
   * Subscribe to all games changes
   */
  static subscribeToAllGames(callback: (payload: any) => void) {
    return supabase
      .channel('all-games')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games',
        },
        callback
      )
      .subscribe();
  }

  // =============================================
  // Admin Utilities
  // =============================================

  /**
   * Check if current user is admin
   */
  static async isCurrentUserAdmin(): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error checking admin status:', error);
      return false;
    }

    return data?.role === 'admin';
  }

  /**
   * Check if current user created a specific game
   */
  static async isGameCreator(gameId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .from('games')
      .select('created_by')
      .eq('id', gameId)
      .single();

    if (error) {
      console.error('Error checking game creator:', error);
      return false;
    }

    return data?.created_by === user.id;
  }

  /**
   * Get games created by current user
   */
  static async getMyGames(): Promise<Game[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('games_with_participants')
      .select('*')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching my games:', error);
      throw error;
    }

    return data || [];
  }

  // =============================================
  // Game Type Specific Methods
  // =============================================

  /**
   * Spin the bottle (admin only for spin_bottle games)
   */
  static async spinBottle(gameId: string): Promise<{ selectedPlayer: GameParticipant; angle: number }> {
    const isAdmin = await this.isCurrentUserAdmin();
    if (!isAdmin) {
      throw new Error('Only administrators can spin the bottle');
    }

    const game = await this.getGame(gameId);
    if (!game || game.type !== 'spin_bottle') {
      throw new Error('Invalid game for bottle spinning');
    }

    if (!game.session_active) {
      throw new Error('Game session must be active to spin the bottle');
    }

    const participants = await this.getGameParticipants(gameId);
    if (participants.length < 2) {
      throw new Error('At least 2 players required to spin the bottle');
    }

    // Generate random angle and select player
    const angle = Math.floor(Math.random() * 360);
    const selectedIndex = Math.floor(Math.random() * participants.length);
    const selectedPlayer = participants[selectedIndex];

    // Update game state with the spin result
    await this.updateGameState(gameId, {
      lastSpin: {
        angle,
        selectedPlayer: selectedPlayer.user_id,
        timestamp: new Date().toISOString(),
      },
    });

    return { selectedPlayer, angle };
  }

  /**
   * Handle buzzer press
   */
  static async pressBuzzer(gameId: string): Promise<{ position: number; timestamp: string }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const game = await this.getGame(gameId);
    if (!game || game.type !== 'buzzer') {
      throw new Error('Invalid game for buzzer press');
    }

    if (!game.session_active) {
      throw new Error('Game session must be active to press buzzer');
    }

    const participants = await this.getGameParticipants(gameId);
    const currentParticipant = participants.find(p => p.user_id === user.id);
    
    if (!currentParticipant) {
      throw new Error('You must join the game first');
    }

    const timestamp = new Date().toISOString();
    const currentBuzzers = game.state.buzzers || [];
    
    // Check if user already pressed buzzer this round
    if (currentBuzzers.some((b: any) => b.userId === user.id)) {
      throw new Error('You have already pressed the buzzer this round');
    }

    const position = currentBuzzers.length + 1;
    const newBuzzer = {
      userId: user.id,
      position,
      timestamp,
    };

    // Update game state
    await this.updateGameState(gameId, {
      buzzers: [...currentBuzzers, newBuzzer],
    });

    return { position, timestamp };
  }
}

export default GameService;