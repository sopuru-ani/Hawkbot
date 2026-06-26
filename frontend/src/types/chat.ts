export type MessageRole = 'user' | 'assistant'

export interface ApiChatMessage {
  role: MessageRole
  content: string
}

export interface ChatSource {
  title: string
  url: string
}

export type ChatStage =
  | 'classifying'
  | 'retrieving'
  | 'generating'
  | 'general'

export interface StreamStatusPayload {
  stage: ChatStage
  message?: string
}

export interface ChatMessage extends ApiChatMessage {
  id: string
  sources?: ChatSource[]
  mode?: 'umes' | 'general'
  streaming?: boolean
  status?: string
  error?: boolean
}

export interface StreamDonePayload {
  mode: 'umes' | 'general'
  sources: ChatSource[]
}
