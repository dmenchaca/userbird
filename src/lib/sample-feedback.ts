// Sample feedback messages with realistic content
const SAMPLE_FEEDBACK_MESSAGES = [
  "I found a bug where the data doesn't save if I accidentally refresh the page. I lost my entire document :(\n\n\n-- This is a sample ticket --",
  "Having trouble with the export feature. It keeps timing out when I try to export large reports.\n\n\n-- This is a sample ticket --",
  "Could we get a dark mode option? My eyes get strained when using the app at night.\n\n\n-- This is a sample ticket --",
  "Would you consider adding integration with Zapier? This would be a game-changer for our workflow.\n\n\n-- This is a sample ticket --",
  "Seeing an error when trying to upload images on Safari. Works fine on Chrome though.\n\n\n-- This is a sample ticket --",
  "Would be great to have keyboard shortcuts for common actions.\n\n\n-- This is a sample ticket --",
  "Please implement a way to customize the notification settings? Getting too many emails.\n\n\n-- This is a sample ticket --",
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

// Helper function to get unique random items from an array
const getUniqueRandomItems = <T>(array: T[], count: number): T[] => {
  // If requested count exceeds array length, return shuffled array
  if (count >= array.length) {
    return shuffleArray([...array]);
  }
  
  // Create a copy of the array to shuffle
  const shuffled = shuffleArray([...array]);
  
  // Return the first 'count' elements
  return shuffled.slice(0, count);
}

// Fisher-Yates shuffle algorithm
const shuffleArray = <T>(array: T[]): T[] => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Creates sample feedback entries for a newly created workspace/form
 * 
 * @param formId The ID of the form to create sample feedback for
 * @param count Number of sample feedback entries to create (default: 3)
 * @returns Promise that resolves immediately after the first request is fired
 */
export const createSampleFeedback = async (
  formId: string,
  count: number = 3
): Promise<void> => {
  try {
    // Get unique feedback messages
    const uniqueMessages = getUniqueRandomItems(SAMPLE_FEEDBACK_MESSAGES, count);
    
    if (uniqueMessages.length === 0) return;
    
    // Send the first feedback immediately and wait for it to be fired
    const firstFeedbackData = {
      formId,
      message: uniqueMessages[0],
      user_name: USER_NAME,
      user_email: USER_EMAIL,
      url_path: getRandomItem(SAMPLE_URL_PATHS),
      operating_system: getRandomItem(SAMPLE_OS),
      screen_category: getRandomItem(SAMPLE_SCREEN_CATEGORIES)
    };
    
    // Fire the first request and wait for it to be sent
    await fetch('/.netlify/functions/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(firstFeedbackData)
    }).catch(error => {
      console.error('Error submitting first sample feedback:', error);
    });
    
    // Send remaining feedback in the background without waiting
    if (uniqueMessages.length > 1) {
      // Fire the rest in the background
      setTimeout(() => {
        // Process the remaining messages
        const remainingMessages = uniqueMessages.slice(1);
        
        remainingMessages.forEach((message, index) => {
          // Add a slight delay between requests to avoid overwhelming the server
          setTimeout(() => {
            const feedbackData = {
              formId,
              message,
              user_name: USER_NAME,
              user_email: USER_EMAIL,
              url_path: getRandomItem(SAMPLE_URL_PATHS),
              operating_system: getRandomItem(SAMPLE_OS),
              screen_category: getRandomItem(SAMPLE_SCREEN_CATEGORIES)
            };
            
            fetch('/.netlify/functions/feedback', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(feedbackData)
            }).catch(error => {
              console.error(`Error submitting additional sample feedback ${index + 2}:`, error);
            });
          }, index * 300); // 300ms between each request
        });
        
        console.log(`Fired first feedback and scheduled ${remainingMessages.length} additional sample feedback requests for form ${formId}`);
      }, 0);
    }
    
    console.log(`First sample feedback sent for form ${formId}`);
  } catch (error) {
    console.error('Error in createSampleFeedback:', error);
  }
} 