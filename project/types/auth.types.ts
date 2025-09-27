import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { Database } from './supabase.types';

// User profile from database
export type UserProfile = Database['public']['Tables']['profiles']['Row'];
export type UserRole = 'user' | 'admin';

// Extended user with auth and profile data
export interface User {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  department: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  full_name: string;
  email: string;
  password: string;
  confirmPassword: string;
  department?: string;
}

export interface AuthResponse {
  user: User;
  session: Session | null;
  requiresEmailConfirmation?: boolean;
}

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<{ requiresEmailConfirmation?: boolean }>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

// Role-based permissions
export interface RolePermissions {
  canCreateAnnouncements: boolean;
  canManageGames: boolean;
  canViewAnalytics: boolean;
  canManageUsers: boolean;
}

export const getRolePermissions = (role: UserRole): RolePermissions => {
  switch (role) {
    case 'admin':
      return {
        canCreateAnnouncements: true,
        canManageGames: true,
        canViewAnalytics: true,
        canManageUsers: true,
      };
    case 'user':
    default:
      return {
        canCreateAnnouncements: false,
        canManageGames: false,
        canViewAnalytics: false,
        canManageUsers: false,
      };
  }
};
