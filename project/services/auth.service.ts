import { supabase, getProfile, createProfile, updateProfile } from '@/lib/supabase';
import {
  User,
  UserProfile,
  AuthResponse,
  LoginCredentials,
  RegisterCredentials,
} from '@/types/auth.types';
import { AuthError } from '@supabase/supabase-js';

class AuthService {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.user || !data.session) {
        throw new Error('Invalid login response');
      }

      // Get user profile from database
      const profile = await getProfile(data.user.id);
      
      const user: User = {
        id: data.user.id,
        email: data.user.email!,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        role: profile.role,
        department: profile.department,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
      };

      return {
        user,
        session: data.session,
      };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    try {
      console.log('Starting registration process for:', credentials.email);
      
      // First, create the auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: {
          data: {
            full_name: credentials.full_name,
            department: credentials.department,
          },
        },
      });

      console.log('Auth signup response:', {
        hasUser: !!authData?.user,
        hasSession: !!authData?.session,
        userEmail: authData?.user?.email,
        userConfirmed: authData?.user?.email_confirmed_at !== null,
        error: authError?.message || 'none'
      });

      if (authError) {
        console.error('Auth signup error:', authError);
        throw new Error(authError.message);
      }

      if (!authData?.user) {
        console.error('Registration failed: No user data returned');
        throw new Error('Registration failed - no user data returned from Supabase');
      }

      // In some cases, session might be null if email confirmation is required
      if (!authData.session) {
        console.warn('Registration successful but no session returned (email confirmation may be required)');
        console.log('User created with ID:', authData.user.id);
        // We'll still try to create the profile
      }

      // Create user profile in database
      console.log('Creating user profile for user ID:', authData.user.id);
      const profileData: UserProfile = {
        id: authData.user.id,
        email: authData.user.email!,
        full_name: credentials.full_name,
        avatar_url: null,
        role: 'user', // Default role
        department: credentials.department || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      console.log('Profile data to create:', profileData);
      const profile = await createProfile(profileData);
      console.log('Profile created successfully:', profile.id);

      const user: User = {
        id: authData.user.id,
        email: authData.user.email!,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        role: profile.role,
        department: profile.department,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
      };

      console.log('Registration completed successfully for user:', user.email);
      
      // If no session, it might be because email confirmation is required
      if (!authData.session) {
        console.log('No session returned - user may need to confirm email');
        // Still return the user data but with null session
        return {
          user,
          session: null,
          requiresEmailConfirmation: true,
        };
      }

      return {
        user,
        session: authData.session,
        requiresEmailConfirmation: false,
      };
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Logout error:', error);
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        return null;
      }

      // Get user profile from database
      const profile = await getProfile(user.id);
      
      return {
        id: user.id,
        email: user.email!,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        role: profile.role,
        department: profile.department,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
      };
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  async getCurrentSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Error getting session:', error);
        return null;
      }
      return session;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }

  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<User> {
    try {
      const updatedProfile = await updateProfile(userId, {
        ...updates,
        updated_at: new Date().toISOString(),
      });

      return {
        id: updatedProfile.id,
        email: updatedProfile.email,
        full_name: updatedProfile.full_name,
        avatar_url: updatedProfile.avatar_url,
        role: updatedProfile.role,
        department: updatedProfile.department,
        created_at: updatedProfile.created_at,
        updated_at: updatedProfile.updated_at,
      };
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }

  // Listen to auth state changes
  onAuthStateChange(callback: (user: User | null, session: any) => void) {
    return supabase.auth.onAuthStateChange(async (event, session) => {
      let user: User | null = null;
      
      if (session?.user) {
        try {
          const profile = await getProfile(session.user.id);
          user = {
            id: session.user.id,
            email: session.user.email!,
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
            role: profile.role,
            department: profile.department,
            created_at: profile.created_at,
            updated_at: profile.updated_at,
          };
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
      }
      
      callback(user, session);
    });
  }

  // Password reset
  async resetPassword(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    
    if (error) {
      throw new Error(error.message);
    }
  }

  // Update password
  async updatePassword(password: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({
      password,
    });
    
    if (error) {
      throw new Error(error.message);
    }
  }
}

export const authService = new AuthService();
