import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import GameService, { Game } from '@/services/game.service';

const gameTypeIcons = {
  buzzer: 'flash' as const,
  trivia: 'bulb' as const, 
  spin_bottle: 'refresh' as const,
  poll: 'people' as const,
};

const gameTypeColors = {
  buzzer: '#F59E0B',
  trivia: '#3B82F6',
  spin_bottle: '#10B981',
  poll: '#8B5CF6',
};

const gameTypeDescriptions = {
  buzzer: 'First to press wins!',
  trivia: 'Test your knowledge',
  spin_bottle: 'Spin and see who it lands on',
  poll: 'Quick polls and votes',
};

export default function GamesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetchGames();
    checkAdminStatus();
    
    // Set up real-time subscription for games
    const subscription = GameService.subscribeToAllGames((payload) => {
      console.log('Games real-time update:', payload);
      fetchGames(); // Refresh games when changes occur
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const checkAdminStatus = async () => {
    try {
      const adminStatus = await GameService.isCurrentUserAdmin();
      setIsAdmin(adminStatus);
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  };

  const fetchGames = async () => {
    try {
      setLoading(true);
      const fetchedGames = await GameService.getGames();
      setGames(fetchedGames);
    } catch (error) {
      console.error('Error fetching games:', error);
      Alert.alert('Error', 'Failed to load games. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchGames();
    setRefreshing(false);
  };

  const handleCreateGame = () => {
    Alert.alert(
      'Create Game',
      'Choose a game type to create',
      [
        { text: 'Buzzer', onPress: () => createGame('buzzer') },
        { text: 'Trivia', onPress: () => createGame('trivia') },
        { text: 'Spin the Bottle', onPress: () => createGame('spin_bottle') },
        { text: 'Poll', onPress: () => createGame('poll') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const createGame = async (type: Game['type']) => {
    // For now, create a basic game. Later you can add a creation modal/screen
    const gameNames = {
      buzzer: 'Quick Buzzer Game',
      trivia: 'Trivia Challenge',
      spin_bottle: 'Spin the Bottle',
      poll: 'Quick Poll'
    };

    try {
      const newGame = await GameService.createGame({
        name: gameNames[type],
        type,
        max_players: type === 'spin_bottle' ? 8 : type === 'trivia' ? 20 : 10,
        min_players: 2
      });
      
      fetchGames(); // Refresh the list
      Alert.alert('Success', `${gameNames[type]} created successfully!`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create game');
    }
  };

  const handleJoinGame = async (game: Game) => {
    if (game.current_players >= (game.max_players || 10)) {
      Alert.alert('Game Full', 'This game is already full.');
      return;
    }

    try {
      await GameService.joinGame(game.id);
      
      // Show success message and refresh
      Alert.alert(
        'Joined Game!', 
        game.session_active 
          ? 'You have joined the active game session.' 
          : `You have joined the game lobby. Game will start when ${game.min_players} players have joined.`,
        [
          { text: 'OK', onPress: () => {
            fetchGames(); // Refresh to show updated player count
            // Navigate to game screen
            router.push(`/games/${game.type}/${game.id}` as any);
          }}
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to join game');
    }
  };

  const handleStartSession = async (gameId: string) => {
    if (!isAdmin) {
      Alert.alert('Admin Required', 'Only administrators can start game sessions.');
      return;
    }

    try {
      await GameService.startGameSession(gameId);
      fetchGames(); // Refresh games list
      Alert.alert('Success', 'Game session started successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to start game session');
    }
  };

  const handleEndSession = async (gameId: string, gameName: string) => {
    Alert.alert(
      'End Game Session',
      `Are you sure you want to end the session for "${gameName}"? Players will be disconnected from active gameplay.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: async () => {
            try {
              await GameService.endGameSession(gameId);
              fetchGames(); // Refresh games list
              Alert.alert('Success', 'Game session ended successfully!');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to end game session');
            }
          }
        }
      ]
    );
  };

  const renderGameCard = (game: Game) => {
    const IconComponent = gameTypeIcons[game.type];
    const color = gameTypeColors[game.type];
    const isGameFull = game.current_players >= (game.max_players || 10);
    const isCreatedByUser = game.created_by === user?.id;
    const canJoinGame = !isGameFull; // Users can join both active and inactive games (lobby)
    const needsMinPlayers = game.current_players < game.min_players;

    return (
      <Card key={game.id} variant="elevated" className="mb-4 mx-4">
        <View className="flex-row items-start justify-between mb-3">
          <View className="flex-row items-center flex-1">
            <View 
              className="w-12 h-12 rounded-lg items-center justify-center mr-3"
              style={{ backgroundColor: color + '20' }}
            >
              <Ionicons name={IconComponent} size={24} color={color} />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-semibold text-gray-900 mb-1">
                {game.name}
              </Text>
              <Text className="text-sm text-gray-600">
                {gameTypeDescriptions[game.type]}
              </Text>
            </View>
          </View>
          
          <View className={`px-2 py-1 rounded-full ${
            game.session_active 
              ? 'bg-green-100' 
              : game.session_status === 'ready'
              ? 'bg-blue-100'
              : 'bg-yellow-100'
          }`}>
            <Text className={`text-xs font-medium ${
              game.session_active
                ? 'text-green-800'
                : game.session_status === 'ready'
                ? 'text-blue-800'
                : 'text-yellow-800'
            }`}>
              {game.session_active ? 'Active' : 
               game.session_status === 'ready' ? 'Ready to Start' : 'Waiting for Players'}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center">
            <Ionicons name="people" size={16} color="#6B7280" />
            <Text className="text-sm text-gray-600 ml-1">
              {game.current_players}/{game.max_players || '∞'} players 
              {needsMinPlayers && (
                <Text className="text-red-600 text-xs"> (min {game.min_players})</Text>
              )}
            </Text>
          </View>
          
          <View className="flex-row items-center">
            <Ionicons name="time" size={16} color="#6B7280" />
            <Text className="text-sm text-gray-600 ml-1">
              {new Date(game.created_at).toLocaleDateString()}
            </Text>
          </View>
        </View>

        <View className="space-y-2">
          {/* Admin Controls */}
          {(isAdmin || isCreatedByUser) && (
            <View className="flex-row space-x-2 mb-2">
              {!game.session_active && game.session_status === 'ready' && (
                <Button
                  title="Start Session"
                  onPress={() => handleStartSession(game.id)}
                  variant="primary"
                  size="sm"
                  className="flex-1"
                  leftIcon={<Ionicons name="play" size={16} color="#FFFFFF" />}
                />
              )}
              {game.session_active && (
                <Button
                  title="End Session"
                  onPress={() => handleEndSession(game.id, game.name)}
                  variant="destructive"
                  size="sm"
                  className="flex-1"
                  leftIcon={<Ionicons name="stop" size={16} color="#FFFFFF" />}
                />
              )}
            </View>
          )}
          
          {/* Admin/Creator Badge */}
          {(isAdmin || isCreatedByUser) && (
            <View className="flex-row items-center justify-center mb-2">
              <Ionicons name="shield-checkmark" size={12} color="#10B981" />
              <Text className="text-xs text-green-600 ml-1 font-medium">
                {isAdmin ? 'Admin Controls' : 'Your Game'}
              </Text>
            </View>
          )}
          
          {/* Player Action Buttons */}
          <View className="flex-row space-x-3">
            <Button
              title={
                isGameFull ? "Game Full" : 
                game.session_active ? "Join Game" : "Join Lobby"
              }
              onPress={() => handleJoinGame(game)}
              disabled={!canJoinGame}
              variant={canJoinGame ? "primary" : "outline"}
              size="sm"
              className="flex-1"
              leftIcon={<Ionicons name="play" size={16} color={canJoinGame ? "#FFFFFF" : "#6B7280"} />}
            />
            
            {(isCreatedByUser || isAdmin) && (
              <Button
                title="Manage"
                onPress={() => router.push(`/games/manage/${game.id}` as any)}
                variant="outline"
                size="sm"
                className="flex-1"
                leftIcon={<Ionicons name="settings" size={16} color="#6B7280" />}
              />
            )}
          </View>
          
          {/* Info Messages */}
          {!game.session_active && needsMinPlayers && (
            <Text className="text-xs text-amber-600 text-center">
              Lobby: {game.current_players}/{game.min_players} players joined • Needs {game.min_players - game.current_players} more to start
            </Text>
          )}
          {!game.session_active && !needsMinPlayers && (
            <Text className="text-xs text-green-600 text-center">
              Ready to start! Admin can begin the session.
            </Text>
          )}
          {game.session_active && (
            <Text className="text-xs text-green-600 text-center">
              🎮 Session Active • Join to play!
            </Text>
          )}
        </View>
      </Card>
    );
  };

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-4 py-4 border-b border-gray-200">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-gray-900">Games</Text>
            <Text className="text-sm text-gray-600 mt-1">
              Join games or create your own
            </Text>
          </View>
          
          <Button
            title="Create"
            onPress={handleCreateGame}
            variant="primary"
            size="sm"
            leftIcon={<Ionicons name="add" size={16} color="#FFFFFF" />}
          />
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingVertical: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3B82F6"
            colors={['#3B82F6']}
          />
        }
      >
        {games.length === 0 ? (
          <View className="flex-1 justify-center items-center py-20">
            <Ionicons name="game-controller" size={64} color="#9CA3AF" />
            <Text className="text-lg font-semibold text-gray-600 mb-2 mt-4">
              No active games
            </Text>
            <Text className="text-base text-gray-500 text-center mb-6 px-8">
              Be the first to start a game! Tap the Create button to get started.
            </Text>
            <Button
              title="Create Your First Game"
              onPress={handleCreateGame}
              variant="primary"
              leftIcon={<Ionicons name="add" size={18} color="#FFFFFF" />}
            />
          </View>
        ) : (
          games.map(renderGameCard)
        )}
      </ScrollView>
    </View>
  );
}