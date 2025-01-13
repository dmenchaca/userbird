// Update the useEffect to use async/await
useEffect(() => {
  async function loadWidget() {
    try {
      // Initialize Userbird
      window.UserBird = window.UserBird || {};
      window.UserBird.formId = "4hNUB7DVhf";
      
      await initUserbird("4hNUB7DVhf");
      console.log('Userbird widget loaded successfully');
    } catch (error) {
      console.error('Failed to load Userbird widget:', error);
    }
  }
  
  loadWidget();
}, []);