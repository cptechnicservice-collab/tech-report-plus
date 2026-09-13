export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agendamentos: {
        Row: {
          cliente_id: string
          concluido: boolean
          created_at: string
          data: string
          data_fim: string | null
          horario: string | null
          id: string
          maquina_servico: string | null
          observacoes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cliente_id: string
          concluido?: boolean
          created_at?: string
          data: string
          data_fim?: string | null
          horario?: string | null
          id?: string
          maquina_servico?: string | null
          observacoes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cliente_id?: string
          concluido?: boolean
          created_at?: string
          data?: string
          data_fim?: string | null
          horario?: string | null
          id?: string
          maquina_servico?: string | null
          observacoes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      apontamentos: {
        Row: {
          cliente_id: string
          created_at: string
          data: string
          diaria_tipo: string
          external_row_id: string | null
          id: string
          intervalo_fim: string | null
          intervalo_inicio: string | null
          km_final: number | null
          km_ida: number | null
          km_inicial: number | null
          km_total: number | null
          km_volta: number | null
          maquina_servico: string | null
          observacoes: string | null
          outras_despesas: number | null
          outras_despesas_descricao: string | null
          pedagio: number | null
          sync_status: string
          synced_at: string | null
          trabalho_fim: string | null
          trabalho_inicio: string | null
          updated_at: string
          user_id: string | null
          viagem_ida_chegada: string | null
          viagem_ida_saida: string | null
          viagem_volta_chegada: string | null
          viagem_volta_saida: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string
          data: string
          diaria_tipo?: string
          external_row_id?: string | null
          id?: string
          intervalo_fim?: string | null
          intervalo_inicio?: string | null
          km_final?: number | null
          km_ida?: number | null
          km_inicial?: number | null
          km_total?: number | null
          km_volta?: number | null
          maquina_servico?: string | null
          observacoes?: string | null
          outras_despesas?: number | null
          outras_despesas_descricao?: string | null
          pedagio?: number | null
          sync_status?: string
          synced_at?: string | null
          trabalho_fim?: string | null
          trabalho_inicio?: string | null
          updated_at?: string
          user_id?: string | null
          viagem_ida_chegada?: string | null
          viagem_ida_saida?: string | null
          viagem_volta_chegada?: string | null
          viagem_volta_saida?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string
          data?: string
          diaria_tipo?: string
          external_row_id?: string | null
          id?: string
          intervalo_fim?: string | null
          intervalo_inicio?: string | null
          km_final?: number | null
          km_ida?: number | null
          km_inicial?: number | null
          km_total?: number | null
          km_volta?: number | null
          maquina_servico?: string | null
          observacoes?: string | null
          outras_despesas?: number | null
          outras_despesas_descricao?: string | null
          pedagio?: number | null
          sync_status?: string
          synced_at?: string | null
          trabalho_fim?: string | null
          trabalho_inicio?: string | null
          updated_at?: string
          user_id?: string | null
          viagem_ida_chegada?: string | null
          viagem_ida_saida?: string | null
          viagem_volta_chegada?: string | null
          viagem_volta_saida?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apontamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          ativo: boolean
          cidade: string | null
          cnpj: string | null
          contato: string | null
          created_at: string
          id: string
          nome: string
          observacoes: string | null
          telefone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ativo?: boolean
          cidade?: string | null
          cnpj?: string | null
          contato?: string | null
          created_at?: string
          id?: string
          nome: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ativo?: boolean
          cidade?: string | null
          cnpj?: string | null
          contato?: string | null
          created_at?: string
          id?: string
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      pecas: {
        Row: {
          codigo: string | null
          created_at: string
          descricao: string
          id: string
          observacoes: string | null
          preco: number
          unidade: string
          updated_at: string
          user_id: string
        }
        Insert: {
          codigo?: string | null
          created_at?: string
          descricao: string
          id?: string
          observacoes?: string | null
          preco?: number
          unidade?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          codigo?: string | null
          created_at?: string
          descricao?: string
          id?: string
          observacoes?: string | null
          preco?: number
          unidade?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      valores_vigencia: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          user_id: string | null
          valor_diaria_inteira: number
          valor_hora_trabalhada: number
          valor_hora_viagem: number
          valor_km: number
          valor_meia_diaria: number
          vigencia: string
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string | null
          valor_diaria_inteira?: number
          valor_hora_trabalhada?: number
          valor_hora_viagem?: number
          valor_km?: number
          valor_meia_diaria?: number
          vigencia: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string | null
          valor_diaria_inteira?: number
          valor_hora_trabalhada?: number
          valor_hora_viagem?: number
          valor_km?: number
          valor_meia_diaria?: number
          vigencia?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
