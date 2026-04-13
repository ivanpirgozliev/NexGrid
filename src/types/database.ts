export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          created_at: string;
        };
        Insert: {
          id: string;
          username: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      scores: {
        Row: {
          id: string;
          user_id: string;
          score: number;
          level: number;
          lines: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          score: number;
          level: number;
          lines: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          score?: number;
          level?: number;
          lines?: number;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      leaderboard: {
        Row: {
          user_id: string;
          username: string;
          best_score: number;
          best_level: number;
          games_played: number;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
