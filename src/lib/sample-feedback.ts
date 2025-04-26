import { nanoid } from 'nanoid'
import { supabase } from './supabase'
import { FeedbackResponse } from './types/feedback'

// Sample feedback messages with realistic content
const SAMPLE_FEEDBACK_MESSAGES = [
  "Love the new dashboard design! Much easier to find what I need now.",
  "Having trouble with the export feature. It keeps timing out when I try to export large reports.",
  "Could we get a dark mode option? My eyes get strained when using the app at night.",
  "The search functionality is amazing! Found exactly what I needed in seconds.",
  "Seeing an error when trying to upload images on Safari. Works fine on Chrome though.",
  "Would be great to have keyboard shortcuts for common actions.",
  "Is there a way to customize the notification settings? Getting too many emails.",
]

// Using Diego's information for all sample feedback
const USER_NAME = "Diego Menchaca"
const USER_EMAIL = "hi@diego.bio"

// Sample URLs that users might be on
const SAMPLE_URL_PATHS = [
  "/dashboard",
  "/settings",
  "/reports/analytics",
  "/user/profile",
  "/pricing",
  "/projects/active",
  "/help"
]

// Sample operating systems
const SAMPLE_OS = [
  "Windows 11",
  "macOS 14.0",
  "iOS 17.2",
  "Android 14",
  "Linux Ubuntu 22.04",
  "Chrome OS"
]

// Sample screen categories
const SAMPLE_SCREEN_CATEGORIES = [
  "Desktop",
  "Tablet",
  "Mobile",
  "Desktop",  // Duplicated to weight towards more common options
  "Desktop"
]

// Helper function to get a random item from an array
const getRandomItem = <T>(array: T[]): T => {
  return array[Math.floor(Math.random() * array.length)]
}

// Helper function to get a random date within the last 2 weeks
const getRandomRecentDate = (): string => {
  const now = new Date()
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
  const randomTime = twoWeeksAgo.getTime() + Math.random() * (now.getTime() - twoWeeksAgo.getTime())
  return new Date(randomTime).toISOString()
}

/**
 * Creates sample feedback entries for a newly created workspace/form
 * 
 * @param formId The ID of the form to create sample feedback for
 * @param count Number of sample feedback entries to create (default: 3)
 * @returns Promise resolving to an array of created feedback entries
 */
export const createSampleFeedback = async (
  formId: string,
  count: number = 3
): Promise<FeedbackResponse[]> => {
  try {
    // Prepare sample feedback data
    const feedbackEntries = Array.from({ length: count }).map(() => {
      return {
        id: nanoid(), // Generate a unique ID for each feedback
        form_id: formId,
        message: getRandomItem(SAMPLE_FEEDBACK_MESSAGES),
        user_name: USER_NAME,
        user_email: USER_EMAIL,
        url_path: getRandomItem(SAMPLE_URL_PATHS),
        operating_system: getRandomItem(SAMPLE_OS),
        screen_category: getRandomItem(SAMPLE_SCREEN_CATEGORIES),
        created_at: getRandomRecentDate(),
        status: 'open',
        // Add tag_id and assignee_id if you want to pre-assign these
      }
    })

    // Insert the sample feedback into the database
    const { data, error } = await supabase
      .from('feedback')
      .insert(feedbackEntries)
      .select('*')

    if (error) {
      console.error('Error creating sample feedback:', error)
      return []
    }

    console.log(`Successfully created ${data.length} sample feedback entries for form ${formId}`)
    return data || []
  } catch (error) {
    console.error('Error in createSampleFeedback:', error)
    return []
  }
} 