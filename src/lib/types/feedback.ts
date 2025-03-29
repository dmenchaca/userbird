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
}

export interface FeedbackReply {
  id: string
  feedback_id: string
  sender_type: 'admin' | 'user'
  content: string
  created_at: string
  updated_at: string
}