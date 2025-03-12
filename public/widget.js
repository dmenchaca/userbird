// Userbird Widget
(function() {
  const API_BASE_URL = 'https://app.userbird.co';
  let settingsLoaded = false;
  let settingsPromise = null;
  let selectedImage = null;
  let currentTrigger = null;
  let modal = null;
  let formId = null;
  let uploadError = null;
  
  const MESSAGES = {
    success: {
      title: 'Thank you',
      description: 'Your message has been received and will be reviewed by our team.',
      imageError: 'Only JPG and PNG images up to 5MB are allowed.'
    },
    labels: {
      submit: 'Send Feedback',
      submitting: 'Sending Feedback...',
      close: 'Close',
      cancel: 'Cancel'
    }
  };

  function getSystemInfo() {
    const ua = navigator.userAgent;
    let os = 'Unknown';
    let urlPath = window.location.pathname + window.location.search;
    
    if (ua.includes('Win')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    
    const width = window.innerWidth;
    let category = 'Desktop';
    
    if (width < 768) category = 'Mobile';
    else if (width < 1024) category = 'Tablet';
    
    return { operating_system: os, screen_category: category, url_path: urlPath };
  }

  function resetForm() {
    selectedImage = null;
    const imagePreview = modal.querySelector('.userbird-image-preview');
    const imageButton = modal.querySelector('.userbird-image-button');
    imagePreview.classList.remove('show');
    imagePreview.innerHTML = '';
    imageButton.style.display = 'block';
    modal.querySelector('.userbird-file-input').value = '';
    uploadError = null;
  }

  async function uploadImage(file) {
    if (!file) return null;
    
    // Validate file type
    if (!file.type.match(/^image\/(jpeg|png)$/)) {
      uploadError = 'Only JPG and PNG images are allowed';
      return null;
    }
    
    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      uploadError = 'Image size must be under 5MB';
      return null;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('formId', formId);
    
    try {
      const response = await fetch(`${API_BASE_URL}/.netlify/functions/upload`, {
        method: 'POST',
        body: formData
      });

      console.log('Upload response:', {
        status: response.status,
        ok: response.ok
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Upload failed:', errorText);
        uploadError = 'Failed to upload image';
        return null;
      }
      
      const data = await response.json();
      console.log('Upload successful:', data);
      
      return {
        url: data.url,
        name: file.name,
        size: file.size
      };
    } catch (error) {
      console.error('Upload error:', error);
      uploadError = 'Failed to upload image';
      return null;
    }
  }

  async function submitFeedback(message) {
    const systemInfo = getSystemInfo();
    const userInfo = window.UserBird?.user || {};
    let imageData = null;
    
    console.group('Widget Submit Flow');
    console.log('1. Starting feedback submission');
    
    // Show success state immediately
    modal.querySelector('.userbird-form').classList.add('hidden');
    modal.querySelector('.userbird-success').classList.add('open');
    console.log('2. Success state shown immediately');

    // Reset form state immediately after showing success
    resetForm();
    console.log('3. Form state reset completed');
    
    console.log('Submitting feedback in background:', {
      formId,
      message,
      userInfo,
      hasImage: !!selectedImage
    });
    console.log('4. Starting background submission');
    
    try {
      // Upload image first if present
      if (selectedImage) {
        try {
          imageData = await uploadImage(selectedImage);
          console.log('5. Image upload completed:', imageData);
        } catch (error) {
          console.error('Image upload failed:', error);
          // Continue with feedback submission without image
          imageData = null;
        }
      }
    
      // Submit feedback
      const response = await fetch(`${API_BASE_URL}/.netlify/functions/feedback`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Origin': window.location.origin
        },
        body: JSON.stringify({ 
          formId, 
          message,
          ...systemInfo,
          user_id: userInfo.id,
          user_email: userInfo.email,
          user_name: userInfo.name,
          image_url: imageData?.url,
          image_name: imageData?.name,
          image_size: imageData?.size,
          url_path: systemInfo.url_path
        })
      });

      console.log('Feedback submission response:', response.status);
      console.log('6. API request completed:', { status: response.status });
      
      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }
      
      console.log('7. Submission successful');
      return response.json();
    } catch (error) {
      console.error('Background submission failed:', error);
      console.log('7. Submission failed:', error);
      // Don't revert success state, just log the error
      return { success: false, error };
    } finally {
      console.log('8. Submit flow completed');
      console.groupEnd();
    }
  }

  // Initialize if form ID is available
  if (window.UserBird?.formId) {
    init().catch(console.error);
  }
})();