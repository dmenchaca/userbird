import { useSearchParams } from 'react-router-dom'
import { Bird } from 'lucide-react'
import { AuthForm } from '@/components/auth/auth-form'
import { AnalyticsDashboard } from '@/components/analytics-dashboard'
import { useEffect } from 'react'
import { initUserbird } from '@/lib/userbird'

export function AuthPage() {
  const [searchParams] = useSearchParams()
  const mode = searchParams.get('mode') === 'signup' ? 'signup' : 'login'

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
    <div className="container relative h-screen grid lg:max-w-none lg:grid-cols-2 lg:px-0 overflow-hidden">
      <div className="lg:p-8">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px] h-full relative">
          <div className="flex justify-center pb-4">
            <a href="/" className="flex items-center gap-2 font-medium">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Bird className="h-4 w-4" />
              </div>
              Userbird
            </a>
          </div>
          <AuthForm mode={mode} />
        </div>
      </div>
      <div className="relative hidden h-full lg:block overflow-hidden">
        <div className="absolute inset-0 flex items-center">
          <div className="relative w-[800px] -translate-x-[200px] z-[2]">
            <div className="absolute -top-24 right-[98px] flex flex-col items-end gap-2 try-me-container">
              <img 
                src="/try-me.svg" 
                alt="Try me!"
                className="text-muted-foreground pb-[0.6rem] translate-x-[5.5rem] w-44 rotate-[10deg]"
              />
              <svg 
                width="50" 
                height="32" 
                viewBox="0 0 200 126" 
                fill="none" 
                className="text-muted-foreground -rotate-[268deg] scale-x-[-1]"
              >
                <path 
                  d="M193.657 0.316911C192.905 3.37782 191.58 6.26578 191.116 9.41317C187.582 37.1508 172.457 58.1092 152.678 75.7867C145.87 81.8755 136.835 86.5107 127.924 89.1482C102.61 97.0185 76.6195 98.7366 50.4939 93.5265C42.9619 92.0399 35.5689 89.0299 28.5168 84.8703C30.9676 84.5129 33.6046 84.0551 36.1564 83.8847C43.5248 83.287 50.994 82.8763 58.3467 81.8043C61.4568 81.3325 64.6207 79.6246 67.4977 77.8303C68.6144 77.2275 69.3813 74.6409 68.9619 73.4189C68.5426 72.1968 66.316 70.7433 65.2845 71.0587C46.8412 74.7376 28.0235 72.825 9.35372 72.5224C2.81504 72.4308 0.0547017 74.8864 0.545756 81.1392C1.90905 96.5773 6.6538 111.156 14.3921 124.601C14.5939 124.975 15.6411 125.134 17.3632 125.653C26.1241 115.613 16.3161 105.457 16.5673 93.0102C19.0809 94.5502 21.0206 95.9173 22.9445 96.81C62.0352 113.127 101.391 111.678 140.524 97.7968C146.426 95.8181 152.18 92.2294 157.259 88.2809C175.814 73.6783 189.412 55.234 196.717 32.7025C199.034 25.4171 199.24 17.3395 199.648 9.63571C199.926 6.58879 198.211 3.41088 197.357 0.4924C196.123 0.433904 194.89 0.375408 193.657 0.316911Z" 
                  fill="currentColor"
                />
              </svg>
            </div>
            <AnalyticsDashboard />
          </div>
          <svg
            className="absolute inset-0 h-full w-full -z-10"
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
      </div>
    </div>
  )
}