import { FormCreator } from './components/form-creator'
import { useEffect } from 'react'
import { initFeedbackWidget } from './lib/feedback-widget'

export default function App() {
  useEffect(() => {
    // Initialize the feedback widget
    const formId = '7swsW33yQE';
    initFeedbackWidget(formId);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <a href="/" className="text-lg font-semibold text-gray-900">
                Userbird
              </a>
              <div className="hidden md:flex items-center space-x-6">
                <a href="/" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors">
                  Home
                </a>
                <a href="/about" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors">
                  About
                </a>
              </div>
            </div>
            <button 
              id="userbird-trigger-7swsW33yQE" 
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
            >
            Feedback
          </button>
          </div>
        </div>
      </nav>
      <div className="container max-w-2xl py-12 space-y-8">
        <div className="space-y-2">
          <p className="text-muted-foreground">Create a feedback form for your website in seconds.</p>
        </div>
        <FormCreator />
      </div>
    </div>
  )
}