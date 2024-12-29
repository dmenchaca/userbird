(function() {
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = src
      script.onload = resolve
      script.onerror = reject
      document.head.appendChild(script)
    })
  }

  async function init() {
    if (!window.UserBird?.formId) {
      console.error('[Userbird] No form ID provided')
      return
    }

    try {
      // Load the widget bundle
      await loadScript('https://userbird.netlify.app/widget.bundle.js')
      
      // Initialize the widget
      window.Userbird.init({
        formId: window.UserBird.formId
      })
    } catch (error) {
      console.error('[Userbird] Failed to load widget:', error)
    }
  }

  init()
})()
