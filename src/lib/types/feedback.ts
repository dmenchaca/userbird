export interface FeedbackResponse {
  id: string
  message: string
  keyboard_shortcut: string | null
  image_url: string | null
  image_name: string | null
  user_id: string | null
  user_email: string | null
  user_name: string | null
  url_path: string | null
  operating_system: string
  screen_category: string
  created_at: string
  status: 'open' | 'closed'
  tag_id: string | null
  tag?: FeedbackTag | null
  ticket_number: number | null
  assignee_id: string | null
  assignee?: {
    id: string
    email: string
    user_name?: string
    avatar_url?: string
  } | null
  _isExiting?: boolean
  _isNew?: boolean
  _isUpdated?: boolean
}

export interface FeedbackTag {
  id: string
  name: string
  color: string
  form_id: string | null
  created_at: string
  is_favorite: boolean
}

export interface FeedbackReply {
  id: string
  feedback_id: string
  sender_type: 'admin' | 'user'
  content?: string
  html_content?: string
  created_at: string
  updated_at: string
  message_id?: string
  in_reply_to?: string
  attachments?: FeedbackAttachment[]
  type?: 'reply' | 'assignment' | 'note' | 'status_change'
  assigned_to?: string
  sender_id?: string
  meta?: Record<string, any>
  // User details for assignments
  assigned_to_user?: {
    id: string
    email: string
    name: string
  }
  assigned_by_user?: {
    id: string
    email: string
    name: string
  }
}

export interface FeedbackAttachment {
  id: string
  reply_id: string
  filename: string
  content_id?: string
  content_type: string
  url: string
  is_inline: boolean
  created_at: string
}