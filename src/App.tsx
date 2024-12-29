import { FormCreator } from './components/form-creator'

export default function App() {
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