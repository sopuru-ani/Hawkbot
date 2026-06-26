export type MessageRole = 'user' | 'assistant'

export interface ApiChatMessage {
  role: MessageRole
  content: string
}

export interface ChatSource {
  title: string
  url: string
}

export interface ChatMessage extends ApiChatMessage {
  id: string
  sources?: ChatSource[]
  mode?: 'umes' | 'general'
  streaming?: boolean
  error?: boolean
}

export interface StreamDonePayload {
  mode: 'umes' | 'general'
  sources: ChatSource[]
}
