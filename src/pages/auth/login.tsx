import { Bird } from 'lucide-react'
import { LoginForm } from '@/components/auth/login-form'
import { AnalyticsDashboard } from '@/components/analytics-dashboard'
import { useEffect } from 'react'
import { initUserbird } from '@/lib/userbird'

export function LoginPage() {
  useEffect(() => {
    async function loadWidget() {
      try {
        await initUserbird("4hNUB7DVhf");
      } catch (error) {
        console.error('Failed to load Userbird widget:', error);
      }
    }
    
    loadWidget();
  }, []);

  return (
    <div className="container relative h-screen flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0">
      <div className="lg:p-8">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
          <div className="flex justify-center pb-4">
            <a href="/" className="flex items-center gap-2 font-medium">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Bird className="h-4 w-4" />
              </div>
              Userbird
            </a>
          </div>
          <LoginForm />
        </div>
      </div>
      <div className="relative hidden h-full flex-col p-10 text-white lg:flex">
        <div className="absolute inset-0 bg-white">
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,transparent_70%,white_100%)] z-10" />
          <div className="absolute inset-0 flex items-center z-[1] overflow-hidden">
            <AnalyticsDashboard />
          </div>
          <button 
            id="userbird-trigger-4hNUB7DVhf"
            className="absolute top-4 right-4 px-3 py-2 rounded-md bg-white/90 text-sm font-medium shadow-sm hover:bg-white/95 transition-colors"
          >
            Feedback
          </button>
          <svg
            className="absolute inset-0 h-full w-full z-0"
            xmlns="http://www.w3.org/2000/svg"
            style={{ filter: 'contrast(1.1)' }}
          >
            <defs>
              <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#D3EDCC" stopOpacity="0.3" />
                <stop offset="50%" stopColor="#FF77F6" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#2BF2B9" stopOpacity="0.3" />
              </linearGradient>
              <filter id="blur" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="70" />
              </filter>
            </defs>
            <circle cx="60%" cy="20%" r="50%" fill="url(#gradient1)" filter="url(#blur)" opacity="0.4" />
            <circle cx="85%" cy="50%" r="45%" fill="#D3EDCC" filter="url(#blur)" opacity="0.2" />
            <circle cx="15%" cy="60%" r="55%" fill="#2BF2B9" filter="url(#blur)" opacity="0.15" />
            <circle cx="40%" cy="80%" r="40%" fill="#FF77F6" filter="url(#blur)" opacity="0.1" />
          </svg>
        </div>
        <div className="relative z-20 mt-auto">
          <blockquote className="space-y-2">
            <p className="text-lg">
              <span className="text-slate-800">"Userbird has transformed how we collect and manage feedback. It's simple, effective, and exactly what we needed."</span>
            </p>
            <footer className="text-sm text-slate-600">Sofia Davis</footer>
          </blockquote>
        </div>
      </div>
    </div>
  )
}