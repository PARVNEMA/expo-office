import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { RoleGuard, usePermissions } from '@/components/auth/RoleGuard';
import { useAuth } from '@/context/AuthContext';
import {
  Users,
  Bell,
  Gamepad2,
  User,
  Settings,
  Plus,
} from 'lucide-react-native';

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
              --
            </Text>
            <Text className="text-sm text-gray-600 dark:text-gray-300">
              Total Users
            </Text>
          </View>
          <View className="flex-1 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <Text className="text-2xl font-bold text-gray-900 dark:text-white">
              --
            </Text>
            <Text className="text-sm text-gray-600 dark:text-gray-300">
              Active Games
            </Text>
          </View>
          <View className="flex-1 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <Text className="text-2xl font-bold text-gray-900 dark:text-white">
              --
            </Text>
            <Text className="text-sm text-gray-600 dark:text-gray-300">
              Announcements
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

      {/* Recent Activity */}
      <View className="p-6">
        <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Recent Activity
        </Text>
        <View className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <Text className="text-gray-600 dark:text-gray-300 text-center">
            No recent activity to display
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
