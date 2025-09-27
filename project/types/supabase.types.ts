export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          role: 'user' | 'admin'
          department: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          role?: 'user' | 'admin'
          department?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          role?: 'user' | 'admin'
          department?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          id: string
          title: string
          content: string
          created_by: string
          target_audience: 'all' | 'department' | 'role'
          target_value: string | null
          scheduled_for: string | null
          sent_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          content: string
          created_by: string
          target_audience?: 'all' | 'department' | 'role'
          target_value?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          content?: string
          created_by?: string
          target_audience?: 'all' | 'department' | 'role'
          target_value?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      user_devices: {
        Row: {
          id: string
          user_id: string
          expo_push_token: string
          device_name: string | null
          device_type: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          expo_push_token: string
          device_name?: string | null
          device_type?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          expo_push_token?: string
          device_name?: string | null
          device_type?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      games: {
        Row: {
          id: string
          name: string
          type: 'buzzer' | 'trivia' | 'spin_bottle' | 'poll'
          created_by: string
          is_active: boolean
          max_players: number | null
          state: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          type: 'buzzer' | 'trivia' | 'spin_bottle' | 'poll'
          created_by: string
          is_active?: boolean
          max_players?: number | null
          state?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          type?: 'buzzer' | 'trivia' | 'spin_bottle' | 'poll'
          created_by?: string
          is_active?: boolean
          max_players?: number | null
          state?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "games_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      game_participants: {
        Row: {
          id: string
          game_id: string
          user_id: string
          joined_at: string
          score: number
          is_active: boolean
        }
        Insert: {
          id?: string
          game_id: string
          user_id: string
          joined_at?: string
          score?: number
          is_active?: boolean
        }
        Update: {
          id?: string
          game_id?: string
          user_id?: string
          joined_at?: string
          score?: number
          is_active?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "game_participants_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: 'user' | 'admin'
      game_type: 'buzzer' | 'trivia' | 'spin_bottle' | 'poll'
      target_audience: 'all' | 'department' | 'role'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}