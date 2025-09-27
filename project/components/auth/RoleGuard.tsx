import React from 'react';
import { View, Text } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { UserRole, getRolePermissions } from '@/types/auth.types';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface RoleGuardProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
  requiredPermission?: keyof ReturnType<typeof getRolePermissions>;
  fallback?: React.ReactNode;
}

export function RoleGuard({ 
  children, 
  requiredRole, 
  requiredPermission,
  fallback 
}: RoleGuardProps) {
  const { user, isLoading, isAuthenticated } = useAuth();

  // Show loading state while auth is initializing
  if (isLoading) {
    return <LoadingSpinner fullScreen />;
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    return fallback || (
      <View className="flex-1 items-center justify-center p-4">
        <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Access Denied
        </Text>
        <Text className="text-gray-600 dark:text-gray-300 text-center">
          You need to be logged in to access this content.
        </Text>
      </View>
    );
  }

  // Check role-based access
  if (requiredRole && user.role !== requiredRole) {
    return fallback || (
      <View className="flex-1 items-center justify-center p-4">
        <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Insufficient Permissions
        </Text>
        <Text className="text-gray-600 dark:text-gray-300 text-center">
          You don't have the required role ({requiredRole}) to access this content.
        </Text>
      </View>
    );
  }

  // Check permission-based access
  if (requiredPermission) {
    const permissions = getRolePermissions(user.role);
    if (!permissions[requiredPermission]) {
      return fallback || (
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Access Restricted
          </Text>
          <Text className="text-gray-600 dark:text-gray-300 text-center">
            You don't have permission to access this feature.
          </Text>
        </View>
      );
    }
  }

  return <>{children}</>;
}

// Hook for checking permissions in components
export function usePermissions() {
  const { user } = useAuth();
  
  const hasRole = (role: UserRole): boolean => {
    return user?.role === role;
  };

  const hasPermission = (permission: keyof ReturnType<typeof getRolePermissions>): boolean => {
    if (!user) return false;
    const permissions = getRolePermissions(user.role);
    return permissions[permission];
  };

  const isAdmin = (): boolean => {
    return user?.role === 'admin';
  };

  return {
    hasRole,
    hasPermission,
    isAdmin,
    permissions: user ? getRolePermissions(user.role) : null,
  };
}