export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      defenseGameStats: {
        Row: {
          assists: number;
          blockedShots: number;
          created_at: string;
          faceoffs: string;
          faceoffWinningPctg: number;
          gameId: number;
          goals: number;
          hits: number;
          pim: number;
          playerId: number;
          plusMinus: number;
          points: number;
          position: Database["public"]["Enums"]["NHL Position Code"];
          powerPlayGoals: number;
          powerPlayPoints: number;
          powerPlayToi: string;
          shorthandedGoals: number;
          shorthandedToi: string;
          shots: number;
          shPoints: number;
          toi: string;
        };
        Insert: {
          assists?: number;
          blockedShots?: number;
          created_at?: string;
          faceoffs?: string;
          faceoffWinningPctg?: number;
          gameId: number;
          goals?: number;
          hits?: number;
          pim?: number;
          playerId?: number;
          plusMinus?: number;
          points?: number;
          position?: Database["public"]["Enums"]["NHL Position Code"];
          powerPlayGoals?: number;
          powerPlayPoints?: number;
          powerPlayToi?: string;
          shorthandedGoals?: number;
          shorthandedToi?: string;
          shots?: number;
          shPoints?: number;
          toi?: string;
        };
        Update: {
          assists?: number;
          blockedShots?: number;
          created_at?: string;
          faceoffs?: string;
          faceoffWinningPctg?: number;
          gameId?: number;
          goals?: number;
          hits?: number;
          pim?: number;
          playerId?: number;
          plusMinus?: number;
          points?: number;
          position?: Database["public"]["Enums"]["NHL Position Code"];
          powerPlayGoals?: number;
          powerPlayPoints?: number;
          powerPlayToi?: string;
          shorthandedGoals?: number;
          shorthandedToi?: string;
          shots?: number;
          shPoints?: number;
          toi?: string;
        };
        Relationships: [
          {
            foreignKeyName: "defenseGameStats_gameId_fkey";
            columns: ["gameId"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "defenseGameStats_playerId_fkey";
            columns: ["playerId"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          }
        ];
      };
      forwardsGameStats: {
        Row: {
          assists: number;
          blockedShots: number;
          created_at: string;
          faceoffs: string;
          faceoffWinningPctg: number;
          gameId: number;
          goals: number;
          hits: number;
          pim: number;
          playerId: number;
          plusMinus: number;
          points: number;
          position: Database["public"]["Enums"]["NHL Position Code"];
          powerPlayGoals: number;
          powerPlayPoints: number;
          powerPlayToi: string;
          shorthandedGoals: number;
          shorthandedToi: string;
          shots: number;
          shPoints: number;
          toi: string;
        };
        Insert: {
          assists?: number;
          blockedShots?: number;
          created_at?: string;
          faceoffs?: string;
          faceoffWinningPctg?: number;
          gameId: number;
          goals?: number;
          hits?: number;
          pim?: number;
          playerId?: number;
          plusMinus?: number;
          points?: number;
          position?: Database["public"]["Enums"]["NHL Position Code"];
          powerPlayGoals?: number;
          powerPlayPoints?: number;
          powerPlayToi?: string;
          shorthandedGoals?: number;
          shorthandedToi?: string;
          shots?: number;
          shPoints?: number;
          toi?: string;
        };
        Update: {
          assists?: number;
          blockedShots?: number;
          created_at?: string;
          faceoffs?: string;
          faceoffWinningPctg?: number;
          gameId?: number;
          goals?: number;
          hits?: number;
          pim?: number;
          playerId?: number;
          plusMinus?: number;
          points?: number;
          position?: Database["public"]["Enums"]["NHL Position Code"];
          powerPlayGoals?: number;
          powerPlayPoints?: number;
          powerPlayToi?: string;
          shorthandedGoals?: number;
          shorthandedToi?: string;
          shots?: number;
          shPoints?: number;
          toi?: string;
        };
        Relationships: [
          {
            foreignKeyName: "forwardsGameStats_gameId_fkey";
            columns: ["gameId"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "forwardsGameStats_playerId_fkey";
            columns: ["playerId"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          }
        ];
      };
      games: {
        Row: {
          awayTeamId: number | null;
          created_at: string;
          date: string;
          homeTeamId: number | null;
          id: number;
          seasonId: number | null;
          startTime: string | null;
          type: number | null;
        };
        Insert: {
          awayTeamId?: number | null;
          created_at?: string;
          date: string;
          homeTeamId?: number | null;
          id?: number;
          seasonId?: number | null;
          startTime?: string | null;
          type?: number | null;
        };
        Update: {
          awayTeamId?: number | null;
          created_at?: string;
          date?: string;
          homeTeamId?: number | null;
          id?: number;
          seasonId?: number | null;
          startTime?: string | null;
          type?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "games_awayTeamId_fkey";
            columns: ["awayTeamId"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "games_homeTeamId_fkey";
            columns: ["homeTeamId"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "games_seasonId_fkey";
            columns: ["seasonId"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          }
        ];
      };
      goaliesGameStats: {
        Row: {
          created_at: string;
          evenStrengthGoalsAgainst: number;
          evenStrengthShotsAgainst: string;
          gameId: number;
          goalsAgainst: number;
          pim: number;
          playerId: number;
          position: Database["public"]["Enums"]["NHL Position Code"];
          powerPlayGoalsAgainst: number;
          powerPlayShotsAgainst: string;
          savePctg: number | null;
          saveShotsAgainst: string;
          shorthandedGoalsAgainst: number;
          shorthandedShotsAgainst: string;
          toi: string | null;
        };
        Insert: {
          created_at?: string;
          evenStrengthGoalsAgainst?: number;
          evenStrengthShotsAgainst?: string;
          gameId: number;
          goalsAgainst?: number;
          pim?: number;
          playerId?: number;
          position?: Database["public"]["Enums"]["NHL Position Code"];
          powerPlayGoalsAgainst?: number;
          powerPlayShotsAgainst?: string;
          savePctg?: number | null;
          saveShotsAgainst?: string;
          shorthandedGoalsAgainst?: number;
          shorthandedShotsAgainst?: string;
          toi?: string | null;
        };
        Update: {
          created_at?: string;
          evenStrengthGoalsAgainst?: number;
          evenStrengthShotsAgainst?: string;
          gameId?: number;
          goalsAgainst?: number;
          pim?: number;
          playerId?: number;
          position?: Database["public"]["Enums"]["NHL Position Code"];
          powerPlayGoalsAgainst?: number;
          powerPlayShotsAgainst?: string;
          savePctg?: number | null;
          saveShotsAgainst?: string;
          shorthandedGoalsAgainst?: number;
          shorthandedShotsAgainst?: string;
          toi?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "goaliesGameStats_gameId_fkey";
            columns: ["gameId"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "goaliesGameStats_playerId_fkey";
            columns: ["playerId"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          }
        ];
      };
      line_combinations: {
        Row: {
          created_at: string;
          date: string;
          defensemen: Json;
          forwards: Json;
          goalies: Json;
          id: number;
          source_url: string;
          team_abbreviation: string;
          team_name: string;
        };
        Insert: {
          created_at?: string;
          date?: string;
          defensemen?: Json;
          forwards?: Json;
          goalies?: Json;
          id?: number;
          source_url?: string;
          team_abbreviation?: string;
          team_name?: string;
        };
        Update: {
          created_at?: string;
          date?: string;
          defensemen?: Json;
          forwards?: Json;
          goalies?: Json;
          id?: number;
          source_url?: string;
          team_abbreviation?: string;
          team_name?: string;
        };
        Relationships: [];
      };
      players: {
        Row: {
          birthCity: string | null;
          birthCountry: string | null;
          birthDate: string;
          firstName: string;
          fullName: string;
          heightInCentimeters: number;
          id: number;
          lastName: string;
          position: Database["public"]["Enums"]["NHL Position Code"];
          weightInKilograms: number;
        };
        Insert: {
          birthCity?: string | null;
          birthCountry?: string | null;
          birthDate: string;
          firstName: string;
          fullName: string;
          heightInCentimeters: number;
          id?: number;
          lastName: string;
          position: Database["public"]["Enums"]["NHL Position Code"];
          weightInKilograms: number;
        };
        Update: {
          birthCity?: string | null;
          birthCountry?: string | null;
          birthDate?: string;
          firstName?: string;
          fullName?: string;
          heightInCentimeters?: number;
          id?: number;
          lastName?: string;
          position?: Database["public"]["Enums"]["NHL Position Code"];
          weightInKilograms?: number;
        };
        Relationships: [];
      };
      rosters: {
        Row: {
          created_at: string;
          playerId: number;
          seasonId: number;
          sweaterNumber: number;
          teamId: number;
        };
        Insert: {
          created_at?: string;
          playerId: number;
          seasonId: number;
          sweaterNumber: number;
          teamId: number;
        };
        Update: {
          created_at?: string;
          playerId?: number;
          seasonId?: number;
          sweaterNumber?: number;
          teamId?: number;
        };
        Relationships: [
          {
            foreignKeyName: "rosters_playerId_fkey";
            columns: ["playerId"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rosters_seasonId_fkey";
            columns: ["seasonId"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rosters_teamId_fkey";
            columns: ["teamId"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          }
        ];
      };
      seasons: {
        Row: {
          created_at: string;
          endDate: string;
          id: number;
          numberOfGames: number;
          regularSeasonEndDate: string;
          startDate: string;
        };
        Insert: {
          created_at?: string;
          endDate: string;
          id?: number;
          numberOfGames: number;
          regularSeasonEndDate: string;
          startDate: string;
        };
        Update: {
          created_at?: string;
          endDate?: string;
          id?: number;
          numberOfGames?: number;
          regularSeasonEndDate?: string;
          startDate?: string;
        };
        Relationships: [];
      };
      statsUpdateStatus: {
        Row: {
          gameId: number;
          updated: boolean;
        };
        Insert: {
          gameId?: number;
          updated?: boolean;
        };
        Update: {
          gameId?: number;
          updated?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "statsUpdateStatus_gameId_fkey";
            columns: ["gameId"];
            isOneToOne: true;
            referencedRelation: "games";
            referencedColumns: ["id"];
          }
        ];
      };
      team_season: {
        Row: {
          created_at: string;
          seasonId: number;
          teamId: number;
        };
        Insert: {
          created_at?: string;
          seasonId: number;
          teamId?: number;
        };
        Update: {
          created_at?: string;
          seasonId?: number;
          teamId?: number;
        };
        Relationships: [
          {
            foreignKeyName: "team_season_seasonId_fkey";
            columns: ["seasonId"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_season_teamId_fkey";
            columns: ["teamId"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          }
        ];
      };
      teamGameStats: {
        Row: {
          blockedShots: number;
          created_at: string;
          faceoffPctg: number;
          gameId: number;
          giveaways: number;
          hits: number;
          pim: number;
          powerPlay: string;
          powerPlayConversion: string;
          powerPlayToi: string;
          score: number;
          sog: number;
          takeaways: number;
          teamId: number;
        };
        Insert: {
          blockedShots?: number;
          created_at?: string;
          faceoffPctg?: number;
          gameId?: number;
          giveaways?: number;
          hits?: number;
          pim?: number;
          powerPlay?: string;
          powerPlayConversion?: string;
          powerPlayToi?: string;
          score?: number;
          sog?: number;
          takeaways?: number;
          teamId: number;
        };
        Update: {
          blockedShots?: number;
          created_at?: string;
          faceoffPctg?: number;
          gameId?: number;
          giveaways?: number;
          hits?: number;
          pim?: number;
          powerPlay?: string;
          powerPlayConversion?: string;
          powerPlayToi?: string;
          score?: number;
          sog?: number;
          takeaways?: number;
          teamId?: number;
        };
        Relationships: [
          {
            foreignKeyName: "teamGameStats_gameId_fkey";
            columns: ["gameId"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teamGameStats_teamId_fkey";
            columns: ["teamId"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          }
        ];
      };
      teams: {
        Row: {
          abbreviation: string;
          created_at: string;
          id: number;
          name: string;
        };
        Insert: {
          abbreviation: string;
          created_at?: string;
          id?: number;
          name: string;
        };
        Update: {
          abbreviation?: string;
          created_at?: string;
          id?: number;
          name?: string;
        };
        Relationships: [];
      };
      users: {
        Row: {
          created_at: string | null;
          id: number;
          role: string;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: number;
          role?: string;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: number;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "users_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      skatersgamestats: {
        Row: {
          assists: number | null;
          blockedShots: number | null;
          created_at: string | null;
          faceoffs: string | null;
          faceoffWinningPctg: number | null;
          gameId: number | null;
          goals: number | null;
          hits: number | null;
          pim: number | null;
          playerId: number | null;
          plusMinus: number | null;
          points: number | null;
          position: Database["public"]["Enums"]["NHL Position Code"] | null;
          powerPlayGoals: number | null;
          powerPlayPoints: number | null;
          powerPlayToi: string | null;
          shorthandedGoals: number | null;
          shorthandedToi: string | null;
          shots: number | null;
          shPoints: number | null;
          toi: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      delete_duplicate_players_in_rosters: {
        Args: {
          _seasonid: number;
        };
        Returns: undefined;
      };
      get_skaters_avg_stats: {
        Args: {
          start_date: string;
          end_date: string;
        };
        Returns: {
          id: number;
          avggoals: number;
          avgassists: number;
          avgplusminus: number;
          avgpim: number;
          avghits: number;
          avgblockedshots: number;
          avgpowerplaypoints: number;
          avgshots: number;
          numgames: number;
        }[];
      };
      get_unupdated_games: {
        Args: Record<PropertyKey, never>;
        Returns: {
          gameid: number;
        }[];
      };
      getAverageDefenseStatsByDateRange: {
        Args: {
          starttime: string;
          endtime: string;
        };
        Returns: {
          id: number;
          avggoals: number;
          avgassists: number;
          avgplusminus: number;
          avgpim: number;
          avghits: number;
          avgblockedshots: number;
          avgpowerplaypoints: number;
          avgshots: number;
          count: number;
        }[];
      };
    };
    Enums: {
      "NHL Position Code": "L" | "R" | "G" | "D" | "C";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (Database["public"]["Tables"] & Database["public"]["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"] &
      Database["public"]["Views"])
  ? (Database["public"]["Tables"] &
      Database["public"]["Views"])[PublicTableNameOrOptions] extends {
      Row: infer R;
    }
    ? R
    : never
  : never;

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
  ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
      Insert: infer I;
    }
    ? I
    : never
  : never;

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
  ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
      Update: infer U;
    }
    ? U
    : never
  : never;

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof Database["public"]["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof Database["public"]["Enums"]
  ? Database["public"]["Enums"][PublicEnumNameOrOptions]
  : never;
