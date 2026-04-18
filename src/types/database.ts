export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      game_sessions: {
        Row: {
          completed: boolean;
          created_at: string;
          heartbeat_count: number;
          id: string;
          last_heartbeat_at: string | null;
          started_at: string;
          token: string;
          user_id: string;
        };
        Insert: {
          completed?: boolean;
          created_at?: string;
          heartbeat_count?: number;
          id?: string;
          last_heartbeat_at?: string | null;
          started_at?: string;
          token?: string;
          user_id: string;
        };
        Update: {
          completed?: boolean;
          created_at?: string;
          heartbeat_count?: number;
          id?: string;
          last_heartbeat_at?: string | null;
          started_at?: string;
          token?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string | null;
          id: string;
          username: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string | null;
          id: string;
          username?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string | null;
          id?: string;
          username?: string;
        };
        Relationships: [];
      };
      scores: {
        Row: {
          created_at: string | null;
          id: string;
          level: number;
          lines: number;
          score: number;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          level?: number;
          lines?: number;
          score?: number;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          level?: number;
          lines?: number;
          score?: number;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      leaderboard: {
        Row: {
          created_at: string | null;
          level: number | null;
          lines: number | null;
          score: number | null;
          score_id: string | null;
          user_id: string | null;
          username: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      get_user_stats: {
        Args: {
          p_user_id: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
