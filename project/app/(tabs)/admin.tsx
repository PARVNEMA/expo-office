import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { RoleGuard, usePermissions } from '@/components/auth/RoleGuard';
import { useAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import {
  Users,
  Bell,
  Gamepad2,
  User,
  Settings,
  Plus,
} from 'lucide-react-native';
import GameService, { Game } from '@/services/game.service';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

export default function AdminScreen() {
  return (
    <RoleGuard requiredRole="admin">
      <AdminContent />
    </RoleGuard>
  );
}

function AdminContent() {
  const { user } = useAuth();
  const { permissions } = usePermissions();
  const [games, setGames] = useState<Game[]>([]);
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [activeGames, setActiveGames] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const allGames = await GameService.getGames();
      setGames(allGames);
      setActiveGames(allGames.filter(game => game.session_active).length);
      
      // TODO: Fetch total users count from profiles table
      // For now, using placeholder
      setTotalUsers(0);
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartSession = async (gameId: string) => {
    try {
      await GameService.startGameSession(gameId);
      fetchAdminData();
      Alert.alert('Success', 'Game session started successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to start game session');
    }
  };

  const handleEndSession = async (gameId: string, gameName: string) => {
    Alert.alert(
      'End Game Session',
      `Are you sure you want to end the session for "${gameName}"?\n\nThis will:\n• Disconnect all active players\n• Stop the current gameplay\n• Return game to lobby state`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: async () => {
            try {
              await GameService.endGameSession(gameId);
              fetchAdminData();
              Alert.alert('Success', `"${gameName}" session ended successfully!`);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to end game session');
            }
          }
        }
      ]
    );
  };

  const handleDeleteGame = async (gameId: string, gameName: string) => {
    Alert.alert(
      'Delete Game',
      `Are you sure you want to delete "${gameName}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await GameService.deleteGame(gameId);
              fetchAdminData();
              Alert.alert('Success', 'Game deleted successfully!');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete game');
            }
          },
        },
      ]
    );
  };

  const handleEndAllSessions = async () => {
    const activeSessions = games.filter(game => game.session_active);
    
    Alert.alert(
      'End All Active Sessions',
      `Are you sure you want to end all ${activeSessions.length} active game sessions?\n\nThis will:\n• Disconnect all players from active games\n• Stop all current gameplay\n• Return all games to lobby state`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `End ${activeSessions.length} Sessions`,
          style: 'destructive',
          onPress: async () => {
            try {
              // End all active sessions
              const promises = activeSessions.map(game => 
                GameService.endGameSession(game.id)
              );
              
              await Promise.all(promises);
              fetchAdminData();
              
              Alert.alert(
                'Success', 
                `All ${activeSessions.length} active sessions have been ended successfully!`
              );
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to end some game sessions');
            }
          },
        },
      ]
    );
  };

  const adminActions = [
    {
      title: 'Send Announcements',
      description: 'Create and send announcements to users',
      icon: Bell,
      onPress: () => console.log('Send Announcements'),
      enabled: permissions?.canCreateAnnouncements,
    },
    {
      title: 'Manage Games',
      description: 'Create and manage office games',
      icon: Gamepad2,
      onPress: () => console.log('Manage Games'),
      enabled: permissions?.canManageGames,
    },
    {
      title: 'View Analytics',
      description: 'View app usage and engagement analytics',
      icon: Gamepad2,
      onPress: () => console.log('View Analytics'),
      enabled: permissions?.canViewAnalytics,
    },
    {
      title: 'Manage Users',
      description: 'View and manage user accounts',
      icon: Users,
      onPress: () => console.log('Manage Users'),
      enabled: permissions?.canManageUsers,
    },
  ];

  return (
    <ScrollView className="flex-1 bg-white dark:bg-gray-900">
      {/* Header */}
      <View className="p-6 bg-primary-600 dark:bg-primary-700">
        <Text className="text-2xl font-bold text-white mb-2">Admin Panel</Text>
        <Text className="text-primary-100 dark:text-primary-200">
          Welcome back, {user?.full_name || user?.email}
        </Text>
      </View>

      {/* Quick Stats */}
      <View className="p-6">
        <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Quick Overview
        </Text>
        <View className="flex-row justify-between space-x-4">
          <View className="flex-1 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <Text className="text-2xl font-bold text-gray-900 dark:text-white">
              {loading ? '--' : totalUsers}
            </Text>
            <Text className="text-sm text-gray-600 dark:text-gray-300">
              Total Users
            </Text>
          </View>
          <View className="flex-1 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <Text className="text-2xl font-bold text-gray-900 dark:text-white">
              {loading ? '--' : activeGames}
            </Text>
            <Text className="text-sm text-gray-600 dark:text-gray-300">
              Active Sessions
            </Text>
          </View>
          <View className="flex-1 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <Text className="text-2xl font-bold text-gray-900 dark:text-white">
              {loading ? '--' : games.length}
            </Text>
            <Text className="text-sm text-gray-600 dark:text-gray-300">
              Total Games
            </Text>
          </View>
        </View>
      </View>

      {/* Admin Actions */}
      <View className="p-6">
        <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Admin Actions
        </Text>
        <View className="space-y-3">
          {adminActions.map((action, index) => (
            <TouchableOpacity
              key={index}
              onPress={action.onPress}
              disabled={!action.enabled}
              className={`p-4 rounded-lg border ${
                action.enabled
                  ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                  : 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 opacity-50'
              }`}
            >
              <View className="flex-row items-center">
                <View
                  className={`p-2 rounded-lg ${
                    action.enabled
                      ? 'bg-primary-100 dark:bg-primary-900'
                      : 'bg-gray-200 dark:bg-gray-600'
                  }`}
                >
                  <action.icon
                    size={24}
                    color={action.enabled ? '#3B82F6' : '#9CA3AF'}
                  />
                </View>
                <View className="ml-4 flex-1">
                  <Text
                    className={`font-semibold ${
                      action.enabled
                        ? 'text-gray-900 dark:text-white'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {action.title}
                  </Text>
                  <Text
                    className={`text-sm ${
                      action.enabled
                        ? 'text-gray-600 dark:text-gray-300'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {action.description}
                  </Text>
                </View>
                {!action.enabled && (
                  <View className="ml-2">
                    <Text className="text-xs text-gray-400 dark:text-gray-500">
                      Coming Soon
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Game Management */}
      <View className="p-6">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-lg font-semibold text-gray-900 dark:text-white">
            Game Management
          </Text>
          {activeGames > 0 && (
            <Button
              title={`End All Sessions (${activeGames})`}
              onPress={handleEndAllSessions}
              variant="destructive"
              size="sm"
              leftIcon={<Ionicons name="stop-circle" size={16} color="#FFFFFF" />}
            />
          )}
        </View>
        {loading ? (
          <View className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <Text className="text-gray-600 dark:text-gray-300 text-center">
              Loading games...
            </Text>
          </View>
        ) : games.length === 0 ? (
          <View className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <Text className="text-gray-600 dark:text-gray-300 text-center">
              No games created yet
            </Text>
          </View>
        ) : (
          <View className="space-y-3">
            {games.map((game) => (
              <Card key={game.id} variant="elevated" className="p-4">
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-1">
                    <Text className="text-lg font-semibold text-gray-900 dark:text-white">
                      {game.name}
                    </Text>
                    <Text className="text-sm text-gray-600 dark:text-gray-300 capitalize">
                      {game.type.replace('_', ' ')} • {game.current_players} players
                    </Text>
                  </View>
                  <View className={`px-2 py-1 rounded-full ${
                    game.session_active ? 'bg-green-100' : 
                    game.session_status === 'ready' ? 'bg-blue-100' : 'bg-yellow-100'
                  }`}>
                    <Text className={`text-xs font-medium ${
                      game.session_active ? 'text-green-800' :
                      game.session_status === 'ready' ? 'text-blue-800' : 'text-yellow-800'
                    }`}>
                      {game.session_active ? 'Active' :
                       game.session_status === 'ready' ? 'Ready' : 'Waiting'}
                    </Text>
                  </View>
                </View>
                
                <View className="flex-row space-x-2">
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
                  <Button
                    title="Delete"
                    onPress={() => handleDeleteGame(game.id, game.name)}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    leftIcon={<Ionicons name="trash" size={16} color="#EF4444" />}
                  />
                </View>
                
                {game.current_players < game.min_players && (
                  <Text className="text-xs text-amber-600 text-center mt-2">
                    Needs {game.min_players - game.current_players} more player{game.min_players - game.current_players !== 1 ? 's' : ''} to start
                  </Text>
                )}
              </Card>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
