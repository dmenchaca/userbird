import { useEffect } from 'react'

export default function FooPage() {
  useEffect(() => {
    // Initialize Userbird
    window.Userbird = window.Userbird || {};
    window.Userbird.formId = "kkkQN6MVLm";
    
    const script = document.createElement('script');
    script.src = 'https://userbird.netlify.app/widget.js';
    document.head.appendChild(script);
  }, []);

  return (
    <div className="container max-w-2xl py-12">
      <button 
        id="userbird-trigger-kkkQN6MVLm"
        className="bg-primary text-primary-foreground shadow hover:bg-primary/90 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium h-9 px-4 py-2"
      >
        Feedback
      </button>
    </div>
  )
}