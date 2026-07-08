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
      abastecimentos: {
        Row: {
          atualizado_em: string | null
          bandeira_posto: string | null
          campos_editados_manualmente: Json | null
          consumo_kml: number | null
          criado_em: string
          data_abastecimento: string
          editado_por: string | null
          empresa_id: string
          excluido_em: string | null
          excluido_por: string | null
          forma_pagamento: string | null
          hora: string | null
          id: string
          km_anterior_snapshot: number | null
          km_atual: number
          km_rodado: number | null
          litros: number
          motorista_id: string | null
          motorista_nome_livre: string | null
          numero_nota: string | null
          ocr_confianca: string | null
          ocr_prompt_version: string | null
          ocr_raw: Json | null
          origem_registro: string
          posto_cidade: string | null
          posto_cnpj: string | null
          posto_nome: string | null
          posto_uf: string | null
          registro_uuid: string
          sincronizado_em: string | null
          status: string
          valor_litro: number | null
          valor_total: number
          veiculo_id: string
        }
        Insert: {
          atualizado_em?: string | null
          bandeira_posto?: string | null
          campos_editados_manualmente?: Json | null
          consumo_kml?: number | null
          criado_em?: string
          data_abastecimento: string
          editado_por?: string | null
          empresa_id: string
          excluido_em?: string | null
          excluido_por?: string | null
          forma_pagamento?: string | null
          hora?: string | null
          id?: string
          km_anterior_snapshot?: number | null
          km_atual: number
          km_rodado?: number | null
          litros: number
          motorista_id?: string | null
          motorista_nome_livre?: string | null
          numero_nota?: string | null
          ocr_confianca?: string | null
          ocr_prompt_version?: string | null
          ocr_raw?: Json | null
          origem_registro?: string
          posto_cidade?: string | null
          posto_cnpj?: string | null
          posto_nome?: string | null
          posto_uf?: string | null
          registro_uuid: string
          sincronizado_em?: string | null
          status?: string
          valor_litro?: number | null
          valor_total: number
          veiculo_id: string
        }
        Update: {
          atualizado_em?: string | null
          bandeira_posto?: string | null
          campos_editados_manualmente?: Json | null
          consumo_kml?: number | null
          criado_em?: string
          data_abastecimento?: string
          editado_por?: string | null
          empresa_id?: string
          excluido_em?: string | null
          excluido_por?: string | null
          forma_pagamento?: string | null
          hora?: string | null
          id?: string
          km_anterior_snapshot?: number | null
          km_atual?: number
          km_rodado?: number | null
          litros?: number
          motorista_id?: string | null
          motorista_nome_livre?: string | null
          numero_nota?: string | null
          ocr_confianca?: string | null
          ocr_prompt_version?: string | null
          ocr_raw?: Json | null
          origem_registro?: string
          posto_cidade?: string | null
          posto_cnpj?: string | null
          posto_nome?: string | null
          posto_uf?: string | null
          registro_uuid?: string
          sincronizado_em?: string | null
          status?: string
          valor_litro?: number | null
          valor_total?: number
          veiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "abastecimentos_editado_por_fkey"
            columns: ["editado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abastecimentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abastecimentos_excluido_por_fkey"
            columns: ["excluido_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abastecimentos_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "motoristas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abastecimentos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      alertas: {
        Row: {
          criado_em: string
          detalhes: Json | null
          empresa_id: string
          entidade_id: string
          entidade_tipo: string
          id: string
          nivel: string
          resolvido: boolean
          resolvido_em: string | null
          resolvido_por: string | null
          tipo_regra: string
        }
        Insert: {
          criado_em?: string
          detalhes?: Json | null
          empresa_id: string
          entidade_id: string
          entidade_tipo: string
          id?: string
          nivel: string
          resolvido?: boolean
          resolvido_em?: string | null
          resolvido_por?: string | null
          tipo_regra: string
        }
        Update: {
          criado_em?: string
          detalhes?: Json | null
          empresa_id?: string
          entidade_id?: string
          entidade_tipo?: string
          id?: string
          nivel?: string
          resolvido?: boolean
          resolvido_em?: string | null
          resolvido_por?: string | null
          tipo_regra?: string
        }
        Relationships: [
          {
            foreignKeyName: "alertas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertas_resolvido_por_fkey"
            columns: ["resolvido_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      edicoes_log: {
        Row: {
          acao: string
          antes: Json | null
          criado_em: string
          depois: Json | null
          empresa_id: string
          id: string
          registro_id: string
          tabela: string
          usuario_id: string
        }
        Insert: {
          acao: string
          antes?: Json | null
          criado_em?: string
          depois?: Json | null
          empresa_id: string
          id?: string
          registro_id: string
          tabela: string
          usuario_id: string
        }
        Update: {
          acao?: string
          antes?: Json | null
          criado_em?: string
          depois?: Json | null
          empresa_id?: string
          id?: string
          registro_id?: string
          tabela?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "edicoes_log_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edicoes_log_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          criado_em: string
          id: string
          nome: string
          proxima_renovacao: string | null
        }
        Insert: {
          criado_em?: string
          id?: string
          nome: string
          proxima_renovacao?: string | null
        }
        Update: {
          criado_em?: string
          id?: string
          nome?: string
          proxima_renovacao?: string | null
        }
        Relationships: []
      }
      midias: {
        Row: {
          criado_em: string
          empresa_id: string
          entidade_id: string
          entidade_tipo: string
          exif_gps: Json | null
          exif_timestamp: string | null
          hash_sha256: string | null
          id: string
          tipo: string
          url: string
        }
        Insert: {
          criado_em?: string
          empresa_id: string
          entidade_id: string
          entidade_tipo: string
          exif_gps?: Json | null
          exif_timestamp?: string | null
          hash_sha256?: string | null
          id?: string
          tipo?: string
          url: string
        }
        Update: {
          criado_em?: string
          empresa_id?: string
          entidade_id?: string
          entidade_tipo?: string
          exif_gps?: Json | null
          exif_timestamp?: string | null
          hash_sha256?: string | null
          id?: string
          tipo?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "midias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      motoristas: {
        Row: {
          ativo: boolean
          cpf: string | null
          criado_em: string
          empresa_id: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          cpf?: string | null
          criado_em?: string
          empresa_id: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          cpf?: string | null
          criado_em?: string
          empresa_id?: string
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "motoristas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          criado_em: string
          email: string
          empresa_id: string
          id: string
          nome: string
          papel: string
          pin_hash: string | null
        }
        Insert: {
          criado_em?: string
          email: string
          empresa_id: string
          id: string
          nome: string
          papel: string
          pin_hash?: string | null
        }
        Update: {
          criado_em?: string
          email?: string
          empresa_id?: string
          id?: string
          nome?: string
          papel?: string
          pin_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      veiculos: {
        Row: {
          ano: number | null
          ativo: boolean
          capacidade_tanque_litros: number | null
          consumo_referencia_kml: number | null
          criado_em: string
          empresa_id: string
          foto_url: string | null
          id: string
          km_atual: number | null
          luckfrotas_veiculo_id: string | null
          marca: string | null
          modelo: string | null
          placa: string
          prefixo: string | null
          proxima_revisao_data: string | null
          proxima_revisao_km: number | null
          qr_gerado_em: string
          qr_token: string
          tipo_combustivel: string | null
        }
        Insert: {
          ano?: number | null
          ativo?: boolean
          capacidade_tanque_litros?: number | null
          consumo_referencia_kml?: number | null
          criado_em?: string
          empresa_id: string
          foto_url?: string | null
          id?: string
          km_atual?: number | null
          luckfrotas_veiculo_id?: string | null
          marca?: string | null
          modelo?: string | null
          placa: string
          prefixo?: string | null
          proxima_revisao_data?: string | null
          proxima_revisao_km?: number | null
          qr_gerado_em?: string
          qr_token?: string
          tipo_combustivel?: string | null
        }
        Update: {
          ano?: number | null
          ativo?: boolean
          capacidade_tanque_litros?: number | null
          consumo_referencia_kml?: number | null
          criado_em?: string
          empresa_id?: string
          foto_url?: string | null
          id?: string
          km_atual?: number | null
          luckfrotas_veiculo_id?: string | null
          marca?: string | null
          modelo?: string | null
          placa?: string
          prefixo?: string | null
          proxima_revisao_data?: string | null
          proxima_revisao_km?: number | null
          qr_gerado_em?: string
          qr_token?: string
          tipo_combustivel?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "veiculos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      usuario_empresa_id: { Args: never; Returns: string }
      usuario_papel: { Args: never; Returns: string }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
