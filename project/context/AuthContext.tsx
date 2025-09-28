import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { Session } from '@supabase/supabase-js';
import { authService } from '../services/auth.service';
import {
  AuthContextType,
  User,
  UserProfile,
  LoginCredentials,
  RegisterCredentials,
} from '../types/auth.types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // const [isAuthenticated, setisAuthenticated] = useState(!!(user && token));

  const isAuthenticated = !!(user && session);
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      setIsLoading(true);

      // Get current session and user
      const [currentSession, currentUser] = await Promise.all([
        authService.getCurrentSession(),
        authService.getCurrentUser(),
      ]);

      if (currentSession && currentUser) {
        setSession(currentSession);
        setUser(currentUser);
      }

      // Set up auth state listener
      const {
        data: { subscription },
      } = authService.onAuthStateChange((user, session) => {
        setUser(user);
        setSession(session);
        setIsLoading(false);
      });

      // Cleanup subscription on unmount
      return () => {
        subscription?.unsubscribe();
      };
    } catch (error) {
      console.error('Error initializing auth:', error);
      setUser(null);
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (credentials: LoginCredentials): Promise<void> => {
    try {
      setIsLoading(true);
      const authResponse = await authService.login(credentials);
      setUser(authResponse.user);
      setSession(authResponse.session);
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    credentials: RegisterCredentials
  ): Promise<{ requiresEmailConfirmation?: boolean }> => {
    try {
      setIsLoading(true);
      const authResponse = await authService.register(credentials);

      // Handle email confirmation case
      if (authResponse.requiresEmailConfirmation) {
        console.log('Registration successful but email confirmation required');
        setUser(null);
        setSession(null);
        return { requiresEmailConfirmation: true };
      }

      setUser(authResponse.user);
      setSession(authResponse.session);
      return { requiresEmailConfirmation: false };
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      setIsLoading(true);
      await authService.logout();
      // Auth state listener will handle clearing user and session
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (
    updates: Partial<UserProfile>
  ): Promise<void> => {
    try {
      if (!user) {
        throw new Error('No user logged in');
      }

      setIsLoading(true);
      const updatedUser = await authService.updateUserProfile(user.id, updates);
      setUser(updatedUser);
    } catch (error) {
      console.error('Profile update error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    session,
    isAuthenticated,
    isLoading,
    isAdmin,
    login,
    register,
    logout,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
