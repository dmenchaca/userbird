/**
 * Utility functions for debugging the Usermonk widget integration
 */

/**
 * Checks and logs the status of the Usermonk widget
 * Use this function to debug widget initialization issues
 */
export function checkUsermonkStatus() {
  const w = window as any;
  console.log('Usermonk status:', {
    exists: !!w.UserMonk,
    initialized: w.UserMonk?._initialized,
    formId: w.UserMonk?.formId,
    hasPendingData: !!w.UserMonk?._pendingUserData,
    hasSetUserInfo: typeof w.UserMonk?.setUserInfo === 'function',
    hasOpen: typeof w.UserMonk?.open === 'function',
    userData: w.UserMonk?.user || {
      note: 'User data not set'
    },
    scriptLoaded: !!document.querySelector('script[src="https://usermonk.netlify.app/widget.js"]'),
    buttonExists: !!document.getElementById('usermonk-trigger-4hNUB7DVhf')
  });
}

/**
 * Manually updates user data in the Usermonk widget
 * @param userData Object containing user data
 */
export function updateUsermonkUser(userData: { id?: string; email?: string; name?: string }) {
  const w = window as any;
  
  if (!w.UserMonk) {
    console.error('Usermonk widget not found');
    return;
  }
  
  try {
    // Try the setUserInfo method first if available
    if (typeof w.UserMonk.setUserInfo === 'function') {
      w.UserMonk.setUserInfo(userData);
      // console.log('Updated Usermonk widget with user data using setUserInfo');
    } 
    // Fall back to directly setting the user object
    else {
      w.UserMonk.user = {
        id: userData.id,
        email: userData.email,
        name: userData.name
      };
      // console.log('Updated Usermonk widget with user data using user object');
    }
  } catch (error) {
    console.error('Error updating Usermonk user data:', error);
  }
}

/**
 * Manually opens the Usermonk widget
 * Useful for testing if the widget is properly initialized
 */
export function openUsermonkWidget() {
  const w = window as any;
  
  if (!w.UserMonk) {
    console.error('Usermonk widget not found');
    return;
  }
  
  try {
    if (typeof w.UserMonk.open === 'function') {
      w.UserMonk.open();
      console.log('Opened Usermonk widget programmatically');
    } else {
      console.error('Usermonk open method not available');
    }
  } catch (error) {
    console.error('Error opening Usermonk widget:', error);
  }
} 