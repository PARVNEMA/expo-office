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

interface Game {
  id: string;
  name: string;
  type: 'buzzer' | 'trivia' | 'spin_bottle' | 'poll';
  created_by: string;
  is_active: boolean;
  max_players?: number;
  current_players: number;
  state: any;
  created_at: string;
}

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

  // Mock data for now - in real app this would come from Supabase
  const mockGames: Game[] = [
    {
      id: '1',
      name: 'Quick Buzzer Round',
      type: 'buzzer',
      created_by: 'admin',
      is_active: true,
      max_players: 10,
      current_players: 3,
      state: { status: 'waiting' },
      created_at: new Date().toISOString(),
    },
    {
      id: '2', 
      name: 'Office Trivia Challenge',
      type: 'trivia',
      created_by: 'admin',
      is_active: true,
      max_players: 20,
      current_players: 8,
      state: { status: 'active', round: 1 },
      created_at: new Date().toISOString(),
    },
    {
      id: '3',
      name: 'Team Building Spin',
      type: 'spin_bottle',
      created_by: user?.id || '',
      is_active: true,
      max_players: 8,
      current_players: 5,
      state: { status: 'waiting' },
      created_at: new Date().toISOString(),
    },
  ];

  useEffect(() => {
    fetchGames();
  }, []);

  const fetchGames = async () => {
    try {
      setLoading(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setGames(mockGames);
    } catch (error) {
      console.error('Error fetching games:', error);
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

  const createGame = (type: Game['type']) => {
    // Navigate to game creation screen
    router.push(`/games/create-${type}` as any);
  };

  const handleJoinGame = (game: Game) => {
    if (game.current_players >= (game.max_players || 10)) {
      Alert.alert('Game Full', 'This game is already full.');
      return;
    }
    
    // Navigate to specific game screen
    router.push(`/games/${game.type}/${game.id}` as any);
  };

  const renderGameCard = (game: Game) => {
    const IconComponent = gameTypeIcons[game.type];
    const color = gameTypeColors[game.type];
    const isGameFull = game.current_players >= (game.max_players || 10);
    const isCreatedByUser = game.created_by === user?.id;

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
            game.state.status === 'active' 
              ? 'bg-green-100' 
              : game.state.status === 'waiting'
              ? 'bg-yellow-100'
              : 'bg-gray-100'
          }`}>
            <Text className={`text-xs font-medium ${
              game.state.status === 'active'
                ? 'text-green-800'
                : game.state.status === 'waiting'
                ? 'text-yellow-800'
                : 'text-gray-800'
            }`}>
              {game.state.status === 'active' ? 'In Progress' : 
               game.state.status === 'waiting' ? 'Waiting' : 'Finished'}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center">
            <Ionicons name="people" size={16} color="#6B7280" />
            <Text className="text-sm text-gray-600 ml-1">
              {game.current_players}/{game.max_players || 10} players
            </Text>
          </View>
          
          <View className="flex-row items-center">
            <Ionicons name="time" size={16} color="#6B7280" />
            <Text className="text-sm text-gray-600 ml-1">
              {new Date(game.created_at).toLocaleDateString()}
            </Text>
          </View>
        </View>

        <View className="flex-row space-x-3">
          <Button
            title={isGameFull ? "Full" : "Join Game"}
            onPress={() => handleJoinGame(game)}
            disabled={isGameFull}
            variant={isGameFull ? "outline" : "primary"}
            size="sm"
            className="flex-1"
            leftIcon={<Ionicons name="play" size={16} color={isGameFull ? "#6B7280" : "#FFFFFF"} />}
          />
          
          {isCreatedByUser && (
            <Button
              title="Manage"
              onPress={() => Alert.alert('Manage Game', 'Game management would go here')}
              variant="outline"
              size="sm"
              className="flex-1"
            />
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