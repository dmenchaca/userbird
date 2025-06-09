import { useSearchParams } from 'react-router-dom'
import { CodeXml, Rocket, Slack } from 'lucide-react'
import { AuthForm } from '@/components/auth/auth-form'
import { AnalyticsDashboard } from '@/components/analytics-dashboard'
import { useEffect } from 'react'
// import { initUsermonk } from '@/lib/userbird'
import { initCursorDemo } from '@/lib/demo-animation'

export function AuthPage() {
  const [searchParams] = useSearchParams()
  const mode = searchParams.get('mode') === 'signup' ? 'signup' : 'login'

  useEffect(() => {
    console.log('🔍 Auth page mounted, preparing to load demo');
    
    async function loadDemo() {
      try {
        // Define the animation function first
        function initAnimation() {
          console.log('🎬 Starting cursor demo animation');
          
          // Check localStorage to see if we've shown animation in this browser session 
          // We'll use localStorage instead of sessionStorage so it persists across refreshes
          const hasSeenAnimation = localStorage.getItem('usermonk_demo_shown');
          
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
          localStorage.setItem('usermonk_demo_shown', 'true');
          
          // Debug: Check if widget elements exist in DOM
          console.log('🔍 Checking DOM for widget elements...');
          
          // Look for the feedback button
          const formId = "4hNUB7DVhf";
          const buttonId = `usermonk-trigger-${formId}`;
          const buttonById = document.getElementById(buttonId);
          
          console.log(`Button by ID ${buttonId} exists:`, !!buttonById);
          
          // Check for any widget-related elements
          const widgetSelectors = [
            '.usermonk-trigger',
            '[id^="usermonk-trigger"]',
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
          console.log('💯 Initializing animation with button found:', !!document.getElementById(`usermonk-trigger-${formId}`));
          const cleanup = initCursorDemo({
            formId: formId,
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
          const widgetButton = document.getElementById(`usermonk-trigger-4hNUB7DVhf`);
          
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
        console.error('❌ Failed to load demo:', error);
      }
    }
    
    loadDemo();
  }, []);

  return (
    <div className="container relative h-screen grid lg:max-w-none lg:grid-cols-[2fr_3fr] lg:px-0 overflow-hidden">
      <div className="lg:p-8 relative">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[366px] h-full relative">
          <div className="flex justify-center pb-4">
            <a href="/" className="flex items-center gap-1 font-medium">
              <span className="text-xl">🌀</span>
              <svg width="100" height="15" viewBox="0 0 592 90" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-foreground">
                <path d="M36.8295 89.2943C25.0944 89.2943 16.0343 86.0154 9.64911 79.4576C3.35017 72.8998 0.200703 63.2357 0.200703 50.4652V9.69473C0.200703 6.84727 0.890998 4.56067 2.27159 2.83493C3.73846 1.10919 5.80934 0.246326 8.48424 0.246326C11.2454 0.246326 13.3594 1.10919 14.8263 2.83493C16.3795 4.56067 17.1561 6.84727 17.1561 9.69473V50.3358C17.1561 58.3605 18.7955 64.4006 22.0744 68.456C25.4396 72.5115 30.3579 74.5393 36.8295 74.5393C43.2147 74.5393 48.0467 72.5115 51.3256 68.456C54.6908 64.4006 56.3734 58.3605 56.3734 50.3358V9.69473C56.3734 6.84727 57.1068 4.56067 58.5737 2.83493C60.1269 1.10919 62.2409 0.246326 64.9158 0.246326C67.5907 0.246326 69.6184 1.10919 70.999 2.83493C72.4659 4.47438 73.1993 6.76098 73.1993 9.69473V50.4652C73.1993 63.322 70.1362 73.0292 64.0098 79.587C57.8834 86.0585 48.8233 89.2943 36.8295 89.2943ZM112.824 89.2943C108.769 89.1217 104.627 88.4314 100.399 87.2234C96.2571 85.9291 92.8488 83.9014 90.1739 81.1402C88.1893 79.1556 87.4559 76.9984 87.9736 74.6687C88.4913 72.3389 89.7856 70.7426 91.8565 69.8798C93.9274 69.0169 95.912 69.4483 97.8103 71.1741C100.658 73.5901 103.203 75.2296 105.447 76.0924C107.776 76.869 110.236 77.2573 112.824 77.2573C116.793 77.2573 119.641 76.6533 121.367 75.4453C123.179 74.2373 124.085 72.4684 124.085 70.1386C124.085 68.2403 123.524 66.8166 122.402 65.8674C121.367 64.9183 119.555 64.1848 116.966 63.6671L104.023 61.2079C98.5869 60.0862 94.4451 58.0153 91.5976 54.9953C88.8365 51.889 87.4559 48.0061 87.4559 43.3466C87.4559 39.3774 88.5776 35.8828 90.821 32.8627C93.1508 29.8427 96.3865 27.513 100.528 25.8735C104.67 24.2341 109.373 23.4143 114.636 23.4143C118.778 23.4143 122.575 24.0615 126.026 25.3558C129.564 26.6501 132.67 28.8073 135.345 31.8273C136.898 33.6393 137.33 35.6239 136.639 37.7811C135.949 39.9383 134.568 41.4051 132.498 42.1817C130.427 42.872 128.442 42.3111 126.544 40.4991C125.508 39.4637 124.602 38.7302 123.826 38.2988C122.273 37.2634 120.763 36.5299 119.296 36.0985C117.829 35.5808 116.362 35.3219 114.895 35.3219C111.444 35.3219 108.682 36.0122 106.612 37.3928C104.541 38.6871 103.505 40.4991 103.505 42.8289C103.505 44.382 103.98 45.7626 104.929 46.9706C105.964 48.0924 107.647 48.8689 109.977 49.3004L122.92 51.7595C128.27 52.795 132.454 54.9522 135.474 58.2311C138.495 61.51 140.005 65.2634 140.005 69.4915C140.005 73.547 138.883 77.1279 136.639 80.2342C134.396 83.2542 131.203 85.584 127.061 87.2234C122.92 88.7766 118.174 89.4669 112.824 89.2943ZM181.754 89.2943C174.678 89.2943 168.552 87.9569 163.375 85.282C158.284 82.6071 154.401 78.8105 151.726 73.8921C149.051 68.9738 147.714 63.1494 147.714 56.419C147.714 50.0338 149.094 44.3389 151.855 39.3342C154.703 34.3296 158.586 30.4467 163.504 27.6855C168.423 24.8381 173.945 23.4143 180.071 23.4143C185.939 23.4143 191.116 24.7086 195.603 27.2972C200.176 29.8858 203.714 33.3373 206.216 37.6517C208.805 41.8797 210.099 46.3666 210.099 51.1124C210.099 53.097 209.668 54.6933 208.805 55.9013C207.942 57.1093 206.777 58.0585 205.31 58.7488C203.843 59.3528 201.945 59.9136 199.615 60.4314L197.803 60.8197C194.524 61.4237 190.943 61.8551 187.06 62.114C183.178 62.3728 177.742 62.5885 170.752 62.7611C167.732 62.7611 164.583 62.8043 161.304 62.8905L161.692 51.2418H165.704C173.815 51.2418 180.244 51.0693 184.99 50.7241C189.735 50.379 193.748 49.5161 197.027 48.1355L194.956 49.9475C195.128 45.9783 193.791 42.7426 190.943 40.2403C188.096 37.6517 184.515 36.3574 180.201 36.3574C174.851 36.3574 170.795 37.9105 168.034 41.0168C165.273 44.1232 163.892 48.7395 163.892 54.8659V56.419C163.892 61.3374 164.626 65.3066 166.093 68.3266C167.646 71.2604 169.76 73.3744 172.435 74.6687C175.11 75.963 178.346 76.6101 182.142 76.6101C184.299 76.6101 186.5 76.3081 188.743 75.7041C191.073 75.1001 193.403 74.151 195.732 72.8567C198.148 71.5624 200.306 71.5192 202.204 72.7272C204.188 73.849 205.181 75.5747 205.181 77.9044C205.181 80.1479 203.93 82.0894 201.427 83.7288C198.839 85.4545 195.775 86.8351 192.238 87.8706C188.7 88.8197 185.205 89.2943 181.754 89.2943ZM228.089 89.0354C225.673 89.0354 223.775 88.2589 222.394 86.7057C221.013 85.1525 220.323 83.0385 220.323 80.3636V32.2156C220.323 29.5407 221.056 27.4698 222.523 26.0029C224.077 24.4498 225.889 23.6732 227.959 23.6732C230.634 23.6732 232.705 24.5792 234.172 26.3912C235.725 28.117 236.502 30.4467 236.502 33.3805V41.1463H235.078C236.372 35.8828 238.141 31.741 240.385 28.721C242.628 25.7009 246.08 23.9752 250.739 23.5438C253.069 23.4575 255.097 23.9752 256.822 25.0969C258.548 26.1324 259.54 27.7718 259.799 30.0153C260.058 32.0862 259.54 33.9413 258.246 35.5808C257.038 37.1339 255.226 38.0399 252.81 38.2988L250.351 38.5577C246.295 38.9891 243.275 39.8951 241.291 41.2757C239.306 42.57 238.012 44.2957 237.408 46.4529C236.804 48.6101 236.502 51.5438 236.502 55.2542V80.3636C236.502 83.1248 235.768 85.282 234.301 86.8351C232.921 88.302 230.85 89.0354 228.089 89.0354ZM278.452 89.0354C275.691 89.0354 273.577 88.302 272.11 86.8351C270.73 85.282 270.039 83.1248 270.039 80.3636V32.0862C270.039 29.325 270.73 27.2541 272.11 25.8735C273.577 24.4066 275.605 23.6732 278.193 23.6732C280.868 23.6732 282.896 24.4066 284.277 25.8735C285.744 27.2541 286.477 29.325 286.477 32.0862V41.2757L285.053 37.1339C286.779 32.8196 289.454 29.4544 293.078 27.0384C296.702 24.6223 301.016 23.4143 306.021 23.4143C311.026 23.4143 315.167 24.6223 318.446 27.0384C321.725 29.4544 324.055 33.1216 325.436 38.0399H323.623C325.349 33.4667 328.197 29.8858 332.166 27.2972C336.135 24.7086 340.708 23.4143 345.885 23.4143C353.047 23.4143 358.397 25.5715 361.935 29.8858C365.473 34.1139 367.241 40.6717 367.241 49.5592V80.3636C367.241 83.1248 366.508 85.282 365.041 86.8351C363.574 88.302 361.46 89.0354 358.699 89.0354C356.024 89.0354 353.953 88.302 352.486 86.8351C351.106 85.282 350.416 83.1248 350.416 80.3636V50.2064C350.416 45.3743 349.596 41.8797 347.956 39.7225C346.403 37.5654 343.815 36.4868 340.191 36.4868C336.049 36.4868 332.813 37.9537 330.483 40.8874C328.154 43.8212 326.989 47.8335 326.989 52.9244V80.3636C326.989 83.1248 326.255 85.282 324.788 86.8351C323.408 88.302 321.337 89.0354 318.576 89.0354C315.901 89.0354 313.83 88.302 312.363 86.8351C310.896 85.282 310.163 83.1248 310.163 80.3636V50.2064C310.163 45.3743 309.343 41.8797 307.704 39.7225C306.15 37.5654 303.605 36.4868 300.067 36.4868C295.925 36.4868 292.69 37.9537 290.36 40.8874C288.03 43.8212 286.865 47.8335 286.865 52.9244V80.3636C286.865 83.1248 286.132 85.282 284.665 86.8351C283.284 88.302 281.214 89.0354 278.452 89.0354ZM412.289 89.2943C406.077 89.2943 400.468 87.8706 395.463 85.0231C390.545 82.1756 386.662 78.2496 383.815 73.245C381.053 68.2403 379.673 62.5885 379.673 56.2896C379.673 50.077 381.053 44.4683 383.815 39.4637C386.662 34.459 390.545 30.533 395.463 27.6855C400.468 24.8381 406.077 23.4143 412.289 23.4143C418.588 23.4143 424.197 24.8381 429.115 27.6855C434.12 30.533 438.003 34.459 440.764 39.4637C443.525 44.4683 444.906 50.077 444.906 56.2896C444.906 62.5885 443.525 68.2403 440.764 73.245C438.003 78.2496 434.12 82.1756 429.115 85.0231C424.197 87.8706 418.588 89.2943 412.289 89.2943ZM412.289 76.6101C415.309 76.6101 418.027 75.7473 420.443 74.0215C422.946 72.2958 424.93 69.9229 426.397 66.9029C427.864 63.7966 428.597 60.2588 428.597 56.2896C428.597 52.3204 427.864 48.8258 426.397 45.8058C424.93 42.6994 422.946 40.3265 420.443 38.6871C418.027 36.9614 415.309 36.0985 412.289 36.0985C409.355 36.0985 406.637 36.9614 404.135 38.6871C401.633 40.3265 399.605 42.6994 398.052 45.8058C396.585 48.8258 395.852 52.3204 395.852 56.2896C395.852 60.2588 396.585 63.7966 398.052 66.9029C399.605 69.9229 401.633 72.2958 404.135 74.0215C406.637 75.7473 409.355 76.6101 412.289 76.6101ZM466.666 89.0354C463.991 89.0354 461.877 88.302 460.324 86.8351C458.771 85.282 457.994 83.1248 457.994 80.3636V32.0862C457.994 29.4113 458.728 27.3404 460.195 25.8735C461.748 24.4066 463.862 23.6732 466.537 23.6732C469.125 23.6732 471.067 24.4066 472.361 25.8735C473.742 27.2541 474.432 29.325 474.432 32.0862V40.6285L473.008 37.1339C474.82 32.7333 477.711 29.3681 481.68 27.0384C485.735 24.6223 490.309 23.4143 495.4 23.4143C502.993 23.4143 508.601 25.5715 512.226 29.8858C515.936 34.1139 517.791 40.6717 517.791 49.5592V80.3636C517.791 83.1248 517.058 85.282 515.591 86.8351C514.21 88.302 512.182 89.0354 509.508 89.0354C506.746 89.0354 504.632 88.302 503.165 86.8351C501.699 85.282 500.965 83.1248 500.965 80.3636V50.3358C500.965 45.5038 500.059 42.0091 498.247 39.852C496.435 37.6085 493.674 36.4868 489.964 36.4868C485.304 36.4868 481.594 37.9537 478.833 40.8874C476.158 43.8212 474.82 47.6609 474.82 52.4067V80.3636C474.82 83.1248 474.13 85.282 472.749 86.8351C471.369 88.302 469.341 89.0354 466.666 89.0354ZM541.983 89.0354C539.222 89.0354 537.194 88.302 535.9 86.8351C534.606 85.3683 533.959 83.2542 533.959 80.493V9.82416C533.959 6.63155 534.606 4.25866 535.9 2.7055C537.194 1.06605 539.222 0.246326 541.983 0.246326C544.658 0.246326 546.643 1.06605 547.937 2.7055C549.318 4.25866 550.008 6.63155 550.008 9.82416V48.9121V49.0415L571.493 26.7795C573.392 24.8812 575.376 23.6732 577.447 23.1555C579.518 22.6377 581.503 23.328 583.401 25.2264C584.35 26.1755 584.954 27.2972 585.213 28.5915C585.558 29.8858 585.515 31.2664 585.084 32.7333C584.652 34.2002 583.746 35.6239 582.366 37.0045L564.375 56.1602L564.504 49.3004L586.896 73.7627C588.967 76.0924 590.218 78.3359 590.649 80.493C591.167 82.6502 590.563 84.6348 588.837 86.4468C587.111 88.4314 585.084 89.1217 582.754 88.5177C580.424 87.9137 578.008 86.3174 575.506 83.7288L555.315 63.2788L550.008 68.5855V80.493C550.008 83.2542 549.318 85.3683 547.937 86.8351C546.643 88.302 544.658 89.0354 541.983 89.0354Z" fill="currentColor"/>
              </svg>
            </a>
          </div>
          <AuthForm mode={mode} />
        </div>
        <p className="text-center text-sm absolute bottom-4 left-0 right-0 text-slate-400">
          Maintained with 💙 by <a href="https://www.linkedin.com/in/diegomenchaca/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-primary">Diego</a>
        </p>
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
                  <img src="/js.svg" alt="JavaScript" className="w-[20px] h-[20px]" />
                </div>
              </div>
              <div className="flex flex-col items-start max-w-[210px]">
                <Rocket className="h-6 w-6 mb-2 text-primary" />
                <p className="text-black">
                  More feedback within a day or I'll pay you $20. <span className="text-black opacity-40">More feedback = better product decisions.</span>
                </p>
              </div>
              <div className="flex flex-col items-start max-w-[210px]">
                <Slack className="h-6 w-6 mb-2 text-primary" />
                <p className="text-black">
                  Reply in Slack. <span className="text-black opacity-40">Get product feedback right into Slack and your CRM.</span>
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