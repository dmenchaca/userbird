import { useSearchParams } from 'react-router-dom'
import { Bird, CodeXml, Rocket, Zap } from 'lucide-react'
import { AuthForm } from '@/components/auth/auth-form'
import { AnalyticsDashboard } from '@/components/analytics-dashboard'
import { useEffect } from 'react'
import { initUserbird } from '@/lib/userbird'
import { initCursorDemo } from '@/lib/demo-animation'

export function AuthPage() {
  const [searchParams] = useSearchParams()
  const mode = searchParams.get('mode') === 'signup' ? 'signup' : 'login'

  useEffect(() => {
    console.log('🔍 Auth page mounted, preparing to load widget and demo');
    
    async function loadWidget() {
      try {
        console.log('🔧 Initializing Userbird widget');
        await initUserbird("4hNUB7DVhf");
        console.log('✅ Userbird widget initialized successfully');
        
        // Define the animation function first
        function initAnimation() {
          console.log('🎬 Starting cursor demo animation');
          
          // Check localStorage to see if we've shown animation in this browser session 
          // We'll use localStorage instead of sessionStorage so it persists across refreshes
          const hasSeenAnimation = localStorage.getItem('userbird_demo_shown');
          
          // Check if page was refreshed - modern approach
          const pageRefreshed = window.performance && 
            (window.performance.navigation?.type === 1 || 
             window.performance.getEntriesByType('navigation').some(
               (nav) => (nav as any).type === 'reload'
             ));
          
          console.log('Animation state:', { hasSeenAnimation, pageRefreshed });
          
          // Only proceed if user hasn't seen animation or explicitly refreshed the page
          if (hasSeenAnimation === 'true' && !pageRefreshed) {
            console.log('🔄 Animation already shown in this session and page was not refreshed, skipping');
            return;
          }
          
          // Set the flag to indicate animation has been shown
          localStorage.setItem('userbird_demo_shown', 'true');
          
          // Debug: Check if widget elements exist in DOM
          console.log('🔍 Checking DOM for widget elements...');
          
          // Look for the feedback button
          const formId = "4hNUB7DVhf";
          const buttonId = `userbird-trigger-${formId}`;
          const buttonById = document.getElementById(buttonId);
          
          console.log(`Button by ID ${buttonId} exists:`, !!buttonById);
          
          // Check for any widget-related elements
          const widgetSelectors = [
            '.userbird-trigger',
            '[id^="userbird-trigger"]',
            '.ub-button',
            '[class*="feedback-button"]',
            '[id*="userbird"]', 
            '[class*="userbird"]', 
            '[id*="ub-"]', 
            '[class*="ub-"]'
          ];
          
          widgetSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            console.log(`Elements matching "${selector}":`, elements.length);
            if (elements.length > 0) {
              elements.forEach(el => {
                // Fix: Check if className is a string before using replace
                const classStr = typeof el.className === 'string' 
                  ? el.className.replace(/ /g, '.') 
                  : Array.from(el.classList).join('.');
                
                console.log(`- ${el.tagName}${el.id ? ' #' + el.id : ''}${el.className ? ' .' + classStr : ''}`);
              });
            }
          });
          
          // Count all buttons on the page
          const allButtons = document.querySelectorAll('button');
          console.log(`Total buttons on page: ${allButtons.length}`);
          
          // Initialize cursor demo, which will now run on every page load
          console.log('💯 Initializing animation with button found:', !!document.getElementById(`userbird-trigger-${formId}`));
          const cleanup = initCursorDemo({
            formId: "4hNUB7DVhf",
            // Start immediately
            delay: 0
          });
          
          // Store cleanup function for component unmounting
          return () => {
            console.log('🧹 Cleaning up cursor demo animation');
            cleanup && cleanup();
          };
        }
        
        // Start cursor demo right after widget has loaded
        // Look for the widget button as indicator that widget has fully initialized
        const checkWidgetButton = () => {
          const widgetButton = document.getElementById(`userbird-trigger-4hNUB7DVhf`);
          
          if (widgetButton) {
            console.log('🎯 Widget button detected in DOM, starting animation');
            // Clear the fallback timer if button is found
            if (fallbackTimer) clearTimeout(fallbackTimer);
            initAnimation();
            return;
          }
          
          // Wait a very short time before checking again
          setTimeout(checkWidgetButton, 100);
        };
        
        // Create fallback timer before starting the check
        let fallbackTimer = setTimeout(() => {
          console.log('⚠️ Widget button check timed out, starting animation anyway');
          initAnimation();
        }, 3000);
        
        // Start the check immediately
        checkWidgetButton();
      } catch (error) {
        console.error('❌ Failed to load Userbird widget:', error);
      }
    }
    
    loadWidget();
  }, []);

  return (
    <div className="container relative h-screen grid lg:max-w-none lg:grid-cols-[2fr_3fr] lg:px-0 overflow-hidden">
      <div className="lg:p-8">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[356px] h-full relative">
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
          <div className="flex flex-col items-center z-10 h-full">
            <div className="flex-1 flex items-center">
              <div className="relative w-[800px] -translate-x-[200px] z-[2]">
                <div className="absolute -top-[4rem] right-[98px] flex flex-col items-end gap-2 try-me-container z-[9999]">
                  <img 
                    src="/try-me.svg" 
                    alt="Try me!"
                    className="text-muted-foreground pb-[0.6rem] translate-x-[2.5rem] w-[7rem] rotate-[6deg]"
                  />
                  <svg 
                    width="50" 
                    height="32" 
                    viewBox="0 0 200 126" 
                    fill="none" 
                    className="text-muted-foreground -rotate-[287deg] scale-x-[-1]"
                  >
                    <path 
                      d="M193.657 0.316911C192.905 3.37782 191.58 6.26578 191.116 9.41317C187.582 37.1508 172.457 58.1092 152.678 75.7867C145.87 81.8755 136.835 86.5107 127.924 89.1482C102.61 97.0185 76.6195 98.7366 50.4939 93.5265C42.9619 92.0399 35.5689 89.0299 28.5168 84.8703C30.9676 84.5129 33.6046 84.0551 36.1564 83.8847C43.5248 83.287 50.994 82.8763 58.3467 81.8043C61.4568 81.3325 64.6207 79.6246 67.4977 77.8303C68.6144 77.2275 69.3813 74.6409 68.9619 73.4189C68.5426 72.1968 66.316 70.7433 65.2845 71.0587C46.8412 74.7376 28.0235 72.825 9.35372 72.5224C2.81504 72.4308 0.0547017 74.8864 0.545756 81.1392C1.90905 96.5773 6.6538 111.156 14.3921 124.601C14.5939 124.975 15.6411 125.134 17.3632 125.653C26.1241 115.613 16.3161 105.457 16.5673 93.0102C19.0809 94.5502 21.0206 95.9173 22.9445 96.81C62.0352 113.127 101.391 111.678 140.524 97.7968C146.426 95.8181 152.18 92.2294 157.259 88.2809C175.814 73.6783 189.412 55.234 196.717 32.7025C199.034 25.4171 199.24 17.3395 199.648 9.63571C199.926 6.58879 198.211 3.41088 197.357 0.4924C196.123 0.433904 194.89 0.375408 193.657 0.316911Z" 
                      fill="currentColor"
                    />
                  </svg>
                </div>
                <AnalyticsDashboard />
              </div>
            </div>
            <div className="flex gap-[72px] pl-10 pb-8 self-stretch">
              <div className="flex flex-col items-start max-w-[210px]">
                <CodeXml className="h-6 w-6 mb-2 text-primary" />
                <p className="text-black">
                  Install widget. <span className="text-black opacity-40">Takes less than 5 minutes.</span>
                </p>
                <div className="flex gap-3 pt-4">
                  <img src="/react.svg" alt="React" className="w-[20px] h-[20px]" />
                  <img src="/vue.svg" alt="Vue" className="w-[20px] h-[20px]" />
                  <img src="/angular.svg" alt="Angular" className="w-[20px] h-[20px]" />
                  <img src="/js.svg" alt="JavaScript" className="w-[20px] h-[20px]" />
                </div>
              </div>
              <div className="flex flex-col items-start max-w-[210px]">
                <Rocket className="h-6 w-6 mb-2 text-primary" />
                <p className="text-black">
                  2x more feedback. <span className="text-black opacity-40">More feedback = better product decisions.</span>
                </p>
              </div>
              <div className="flex flex-col items-start max-w-[210px]">
                <Zap className="h-6 w-6 mb-2 text-primary" />
                <p className="text-black">
                  Automate. <span className="text-black opacity-40">Get product feedback right into your CRM or Slack.</span>
                </p>
              </div>
            </div>
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