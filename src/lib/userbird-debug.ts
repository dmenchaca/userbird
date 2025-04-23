/**
 * Utility functions for debugging the Userbird widget integration
 */

/**
 * Checks and logs the status of the Userbird widget
 * Use this function to debug widget initialization issues
 */
export function checkUserbirdStatus() {
  const w = window as any;
  console.log('Userbird status:', {
    exists: !!w.UserBird,
    initialized: w.UserBird?._initialized,
    formId: w.UserBird?.formId,
    hasPendingData: !!w.UserBird?._pendingUserData,
    hasSetUserInfo: typeof w.UserBird?.setUserInfo === 'function',
    hasOpen: typeof w.UserBird?.open === 'function',
    userData: w.UserBird?.user || {
      note: 'User data not set'
    },
    scriptLoaded: !!document.querySelector('script[src="https://userbird.netlify.app/widget.js"]'),
    buttonExists: !!document.getElementById('userbird-trigger-4hNUB7DVhf')
  });
}

/**
 * Manually updates user data in the Userbird widget
 * @param userData Object containing user data
 */
export function updateUserbirdUser(userData: { id?: string; email?: string; name?: string }) {
  const w = window as any;
  
  if (!w.UserBird) {
    console.error('Userbird widget not found');
    return;
  }
  
  try {
    // Try the setUserInfo method first if available
    if (typeof w.UserBird.setUserInfo === 'function') {
      w.UserBird.setUserInfo(userData);
      console.log('Updated Userbird widget with user data using setUserInfo');
    } 
    // Fall back to directly setting the user object
    else {
      w.UserBird.user = {
        id: userData.id,
        email: userData.email,
        name: userData.name
      };
      console.log('Updated Userbird widget with user data using user object');
    }
  } catch (error) {
    console.error('Error updating Userbird user data:', error);
  }
}

/**
 * Manually opens the Userbird widget
 * Useful for testing if the widget is properly initialized
 */
export function openUserbirdWidget() {
  const w = window as any;
  
  if (!w.UserBird) {
    console.error('Userbird widget not found');
    return;
  }
  
  try {
    if (typeof w.UserBird.open === 'function') {
      w.UserBird.open();
      console.log('Opened Userbird widget programmatically');
    } else {
      console.error('Userbird open method not available');
    }
  } catch (error) {
    console.error('Error opening Userbird widget:', error);
  }
} 