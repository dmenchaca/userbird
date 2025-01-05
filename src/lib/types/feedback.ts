export interface FeedbackResponse {
  id: string
  message: string
  image_url: string | null
  image_name: string | null
  user_id: string | null
  user_email: string | null
  user_name: string | null
  operating_system: string
  screen_category: string
  created_at: string
}