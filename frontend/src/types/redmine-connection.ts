export type RedmineAuthType = 'api_key' | 'basic'
export type RedmineConnectionSource = 'environment' | 'file' | 'legacy_config' | 'cleared' | 'none'

export interface RedmineConnectionPayload {
  base_url: string
  auth_type: RedmineAuthType
  api_key?: string
  username?: string
  password?: string
}

export interface RedmineConnectionSummary {
  base_url: string
  auth_type: RedmineAuthType
  auth_identity: string
  source: RedmineConnectionSource
  uses_https: boolean
}

export interface RedmineConnectionStatusResponse {
  configured: boolean
  connected: boolean
  can_save: boolean
  message: string
  warning: string | null
  server_user: string | null
  connection: RedmineConnectionSummary | null
}

export interface RedmineConnectionTestResponse {
  success: boolean
  message: string
  warning: string | null
  server_user: string | null
  connection: RedmineConnectionSummary
}

export interface RedmineConnectionSaveResponse {
  saved: boolean
  message: string
  warning: string | null
  server_user: string | null
  cleared_cache_keys: number
  connection: RedmineConnectionSummary
}

export interface RedmineConnectionDeleteResponse {
  deleted: boolean
  message: string
  cleared_cache_keys: number
}