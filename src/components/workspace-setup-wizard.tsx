import { useState, useEffect, KeyboardEvent, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { Loader, ArrowLeft, MessageSquare, Slack, Rocket } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { createSampleFeedback } from '@/lib/sample-feedback'
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';

interface WorkspaceSetupWizardProps {
  onComplete: () => void
}

// Generate a random ID similar to "4hNUB7DVhf" (10 characters of alphanumeric)
function generateShortId(length = 10): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// Add custom CSS for Plyr color customization
const customPlyrStyles = `
  :root {
    --plyr-color-main: #1d8eff;
    --plyr-range-fill-background: #1d8eff;
    --plyr-badge-background: #1d8eff;
    --plyr-menu-background: white;
    --plyr-menu-color: #333;
    --plyr-menu-border-color: rgba(0, 0, 0, 0.1);
  }
  
  /* Fix icon visibility on hover */
  .plyr--video .plyr__control:hover {
    background-color: rgba(29, 142, 255, 0.7) !important; /* Semi-transparent blue */
  }
  
  /* Ensure icons remain visible on hover */
  .plyr--video .plyr__control:hover svg {
    color: white !important;
    opacity: 1 !important;
  }
  
  /* Fix for the play button specifically */
  .plyr--video .plyr__control[data-plyr="play"]:hover svg {
    color: white !important;
    fill: white !important;
    opacity: 1 !important;
  }
  
  /* Ensure speed menu is visible */
  .plyr__menu__container {
    display: block !important;
  }
  
  /* Make all menu items visible */
  .plyr__menu__container .plyr__control {
    display: flex !important;
  }
  
  /* Fix menu styling */
  .plyr__menu__container .plyr__control--back::after {
    border-right-color: rgba(0, 0, 0, 0.2) !important;
  }
  
  /* Style the active item in menu */
  .plyr__menu__container [role="menu"] .plyr__control[aria-checked="true"]::after {
    background: #1d8eff !important;
    border-color: #1d8eff !important;
  }
  
  /* Style hovered menu items */
  .plyr__menu__container [role="menu"] .plyr__control:hover,
  .plyr__menu__container [role="menuitem"]:hover {
    background: rgba(29, 142, 255, 0.1) !important;
    color: #1d8eff !important;
  }
`;

export function WorkspaceSetupWizard({ onComplete }: WorkspaceSetupWizardProps) {
  const [step, setStep] = useState(1)
  const [productName, setProductName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const { user } = useAuth()
  const [createdFormId, setCreatedFormId] = useState<string | null>(null)
  const [backgroundCreating, setBackgroundCreating] = useState(false)
  const [backgroundError, setBackgroundError] = useState<string | null>(null)
  const [hoveredFeature, setHoveredFeature] = useState<'widget' | 'guarantee' | 'slack' | null>(null)
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<Plyr | null>(null);
  
  // Get user's first name for the welcome message
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 
                   user?.user_metadata?.name?.split(' ')[0] || 
                   user?.email?.split('@')[0] || 
                   'there'

  // --- Robust onboarding state: persist step and completion flag ---
  useEffect(() => {
    if (!user?.id) return;
    const completedKey = `userbird-onboarding-completed-${user.id}`;
    const stepKey = `userbird-onboarding-step-${user.id}`;
    // On mount, check if onboarding is completed
    const completed = localStorage.getItem(completedKey);
    if (completed === 'true') {
      // Redirect to dashboard if onboarding is completed
      navigate('/', { replace: true });
      return;
    }
    // Otherwise, restore step and formId if present
    const saved = localStorage.getItem(stepKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (
          typeof parsed === 'object' &&
          parsed !== null &&
          typeof parsed.step === 'number' &&
          parsed.step >= 2 &&
          typeof parsed.formId === 'string' &&
          parsed.formId.length > 0
        ) {
          setStep(parsed.step);
          setCreatedFormId(parsed.formId);
        }
      } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Persist onboarding step and formId for any step >= 2
  useEffect(() => {
    if (!user?.id) return;
    const stepKey = `userbird-onboarding-step-${user.id}`;
    if (step >= 2 && createdFormId) {
      localStorage.setItem(
        stepKey,
        JSON.stringify({ step, formId: createdFormId })
      );
    }
  }, [step, createdFormId, user?.id]);

  // Fetch product name for any step >= 2 if form exists
  useEffect(() => {
    const fetchProductName = async () => {
      if (createdFormId && step >= 2) {
        const { data, error } = await supabase
          .from('forms')
          .select('product_name')
          .eq('id', createdFormId)
          .single();
        if (!error && data?.product_name) {
          if (!productName || productName !== data.product_name) {
            setProductName(data.product_name);
          }
        }
      }
    };
    fetchProductName();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createdFormId, step]);

  // Function to create default tags for a new form
  const createDefaultTags = async (formId: string) => {
    try {
      const defaultTags = [
        { name: 'Bug', color: '#EF4444', is_favorite: true },        // Red
        { name: 'Data loss', color: '#64748B', is_favorite: true },  // Grey
        { name: 'Glitch', color: '#EAB308', is_favorite: true },     // Yellow
        { name: 'New feature', color: '#10B981', is_favorite: true }, // Green
        { name: 'Love it', color: '#EC4899', is_favorite: true }     // Pink
      ];
      
      // Insert all default tags with the form_id
      const { error } = await supabase
        .from('feedback_tags')
        .insert(defaultTags.map(tag => ({
          name: tag.name,
          color: tag.color,
          form_id: formId,
          is_favorite: tag.is_favorite
        })));
      
      if (error) {
        console.error('Error creating default tags:', error);
      } else {
        console.log('Successfully created default tags for form:', formId);
      }
    } catch (error) {
      console.error('Error in createDefaultTags:', error);
    }
  };

  // Background form creation or patch for step 2
  const handleBackgroundFormCreationOrPatch = async (name: string): Promise<string | null> => {
    if (backgroundCreating) return createdFormId; // Prevent duplicate
    setBackgroundCreating(true);
    setBackgroundError(null);
    try {
      let resultFormId = createdFormId;
      
      if (createdFormId) {
        // Patch the existing form's name
        const { error: updateError } = await supabase
          .from('forms')
          .update({ product_name: name })
          .eq('id', createdFormId);
        if (updateError) throw updateError;
      } else {
        // Create a new form with a guaranteed ID first
        const formId = generateShortId();
        const formData = {
          id: formId,
          product_name: name,
          owner_id: user?.id,
          show_gif_on_success: true,
          remove_branding: false,
          keyboard_shortcut: 'F',
          gif_urls: [
            'https://media1.tenor.com/m/TqHquUQoqu8AAAAd/you%27re-a-lifesaver-dove.gif',
            'https://media1.tenor.com/m/4PLfYPBvjhQAAAAd/tannerparty-tanner.gif',
            'https://media1.tenor.com/m/lRY5I7kwR08AAAAd/brooklyn-nine-nine-amy-and-rosa.gif',
            'https://media1.tenor.com/m/9LbEpuHBPScAAAAd/brooklyn-nine-nine-amy-and-rosa.gif',
            'https://media1.tenor.com/m/mnx8ECSie6EAAAAd/sheldon-cooper-big-bang-theory.gif'
          ]
        };
        
        const { error } = await supabase
          .from('forms')
          .insert(formData);
        
        if (error) throw error;
        
        // Important: Set the formId first before any other operations
        resultFormId = formId;
        setCreatedFormId(formId);
        
        // Create default tags for the new form
        await createDefaultTags(formId);
        
        if (formId && user?.id && user?.email) {
          await supabase
            .from('form_collaborators')
            .insert({
              form_id: formId,
              user_id: user.id,
              role: 'admin',
              invited_by: user.id,
              invitation_email: user.email,
              invitation_accepted: true
            });
        }
        
        if (user?.id && resultFormId) {
          localStorage.setItem(`userbird-last-form-${user.id}`, resultFormId);
        }
      }
      return resultFormId;
    } catch (err: any) {
      setBackgroundError(err.message || 'Failed to create or update workspace');
      if (!createdFormId) setCreatedFormId(null);
      return null;
    } finally {
      setBackgroundCreating(false);
    }
  };

  const handleNext = () => {
    if (step === 1) {
      setStep(2);
    } else if (step === 2 && productName.trim()) {
      handleWorkspaceCreation();
    }
  };

  // Direct click handler for first step button
  const handleStep1Next = () => {
    handleNext();
  };
  
  // Handle keyboard events
  const handleKeyPress = (e: KeyboardEvent<HTMLDivElement | HTMLFormElement>) => {
    if (e.key === 'Enter' && step === 1) {
      e.preventDefault();
      handleStep1Next();
    }
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  // Onboarding completion: set completed flag and clear step state
  const markOnboardingComplete = () => {
    if (!user?.id) return;
    const completedKey = `userbird-onboarding-completed-${user.id}`;
    const stepKey = `userbird-onboarding-step-${user.id}`;
    localStorage.setItem(completedKey, 'true');
    localStorage.removeItem(stepKey);
  };

  // Workspace creation and navigation
  const handleWorkspaceCreation = async () => {
    if (!productName.trim() || backgroundCreating || isCreating) return;
    
    // Show loading state immediately
    setIsCreating(true);
    
    try {
      // Create or update the form and get the form ID directly
      const formId = await handleBackgroundFormCreationOrPatch(productName.trim());
      
      if (!formId) {
        console.error('No form ID available after creation');
        setBackgroundError('Failed to create workspace. Please try again.');
        setIsCreating(false);
        return;
      }
      
      console.log(`Successfully created/updated form with ID: ${formId}`);
      
      // Create sample feedback
      try {
        console.log(`Creating sample feedback for form ID: ${formId}`);
        await createSampleFeedback(formId);
        console.log('Successfully initiated sample feedback creation');
      } catch (sampleError) {
        console.error('Error creating sample feedback:', sampleError);
        // Continue even if sample feedback creation fails
      }
      
      // Mark onboarding as complete
      markOnboardingComplete();
      onComplete();
      
      // Save form ID in localStorage for quick access
      if (user?.id) {
        localStorage.setItem(`userbird-last-form-${user.id}`, formId);
      }
      
      // Set a flag in localStorage to indicate intentional navigation
      localStorage.setItem('userbird-navigating-to-new-form', formId);
      
      // Navigate using React Router (faster than window.location)
      navigate(`/forms/${formId}`);
      
      // Clear the navigation flag after 1 second
      setTimeout(() => {
        localStorage.removeItem('userbird-navigating-to-new-form');
      }, 1000);
    } catch (err) {
      console.error('Error in workspace creation:', err);
      setBackgroundError('Failed to create workspace. Please try again.');
      setIsCreating(false);
    }
  };

  // Initialize Plyr as soon as component mounts
  useEffect(() => {
    if (videoRef.current) {
      // Insert custom CSS for Plyr
      const styleEl = document.createElement('style');
      styleEl.innerHTML = customPlyrStyles;
      document.head.appendChild(styleEl);

      playerRef.current = new Plyr(videoRef.current, {
        controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'settings', 'fullscreen'],
        hideControls: false,
        fullscreen: { enabled: true },
        resetOnEnd: false,
        invertTime: false,
        keyboard: { focused: true, global: false },
        clickToPlay: true,
        settings: ['speed'],
        speed: {
          selected: 1,
          options: [1, 1.5, 2]
        },
        markers: {
          enabled: true,
          points: [
            {
              time: 57,
              label: "Your guarantee"
            }
          ]
        }
      });
      
      // Force update the speed menu to ensure all options are displayed
      setTimeout(() => {
        if (playerRef.current) {
          // Trigger a UI update
          playerRef.current.toggleControls(true);
          playerRef.current.toggleControls(false);
          playerRef.current.toggleControls(true);
        }
      }, 500);

      // No need to track video playing state with our current implementation

      return () => {
        if (playerRef.current) {
          playerRef.current.destroy();
        }
        // Remove custom styles when component unmounts
        document.head.removeChild(styleEl);
      };
    }
  }, [videoRef]);

  return (
    <div 
      id="wizard-container"
      className="fixed inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-center justify-center p-4" 
      onKeyDown={handleKeyPress}
      tabIndex={0} // Make div focusable to capture key events
    >
      <svg
        className="absolute inset-0 h-full w-full -z-10"
        xmlns="http://www.w3.org/2000/svg"
        style={{ filter: 'contrast(1.1)' }}
      >
        <defs>
          <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#D3EDCC" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#FF77F6" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#2BF2B9" stopOpacity="0.2" />
          </linearGradient>
          <filter id="blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="70" />
          </filter>
        </defs>
        <circle cx="60%" cy="20%" r="50%" fill="url(#gradient1)" filter="url(#blur)" opacity="0.25" />
        <circle cx="85%" cy="50%" r="45%" fill="#D3EDCC" filter="url(#blur)" opacity="0.1" />
        <circle cx="15%" cy="60%" r="55%" fill="#2BF2B9" filter="url(#blur)" opacity="0.08" />
        <circle cx="40%" cy="80%" r="40%" fill="#FF77F6" filter="url(#blur)" opacity="0.07" />
      </svg>
      
      <div className="flex flex-col items-end w-full max-w-xl">
        {/* Header flex container with back button and feedback button */}
        <div className="mb-4 w-full flex justify-between items-center">
          {/* Back button - only show on step 2 */}
          {step > 1 && (
            <button 
              type="button"
              onClick={handleBack}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center transition-colors"
            >
              <ArrowLeft className="h-3 w-3 mr-1" />
              <span>Back</span>
            </button>
          )}
          
          {/* Push feedback button to the right */}
          <div className="ml-auto">
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  (function(w, d, s, o) {
                    w.UserBirdObject = o;
                    w[o] = w[o] || function() {
                      (w[o].q = w[o].q || []).push(arguments);
                    };
                    const f = d.getElementsByTagName(s)[0];
                    const ubird = d.createElement(s);
                    ubird.async = 1;
                    ubird.src = 'https://cdn.userbird.co/userbird.js';
                    f.parentNode.insertBefore(ubird, f);
                  })(window, document, 'script', 'ub');
                  ub('form', '4hNUB7DVhf');
                `
              }}
            />
            <button 
              id="userbird-trigger-4hNUB7DVhf"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:text-accent-foreground py-2 gap-2 h-9 px-3 relative transition-all duration-200 hover:bg-white/50 hover:border-border/60 hover:shadow-sm"
            >
              <span className="pointer-events-none">Feedback</span>
              <span className="px-1.5 py-0.5 text-xs rounded bg-muted text-muted-foreground pointer-events-none">F</span>
            </button>
          </div>
        </div>
        
        <div className="bg-background rounded-lg shadow-lg border w-full transition-all duration-500 ease-in-out" style={{ paddingTop: "28px", paddingBottom: "36px", paddingLeft: "2rem", paddingRight: "2rem" }}>
          <div>
        {step === 1 && (
              <div 
                className="text-center animate-in fade-in slide-in-from-bottom-4 duration-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    handleNext();
                  }
                }}
              >
                <div className="space-y-2 mb-5">
              <h2 className="text-2xl font-semibold">Hi {firstName}, welcome to Userbird 🎉</h2>
                </div>
                
                <div className="mb-6" style={{ position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: "8px", border: "1px solid hsl(var(--muted))" }}>
                  <div 
                    style={{ 
                      position: "absolute", 
                      top: 0, 
                      left: 0, 
                      width: "100%", 
                      height: "100%", 
                      borderRadius: "8px",
                      overflow: "hidden"
                    }}
                  >
                    <video
                      ref={videoRef}
                      poster="https://tapssagpmxnjvdwyafsq.supabase.co/storage/v1/object/public/app//Video%20thumbnail.webp"
                      style={{ width: "100%", height: "100%" }}
                      playsInline
                      className="plyr-video"
                    >
                      <source 
                        src="https://tapssagpmxnjvdwyafsq.supabase.co/storage/v1/object/public/app//Welcome%20Userbird%20for%20import.webm" 
                        type="video/webm" 
                      />
                      Your browser does not support the video tag.
                    </video>
                  </div>
                </div>
                
                {/* Feature rows with hover effect */}
                <div className="mb-6 space-y-4">
                  <div 
                    className="flex items-center transition-opacity duration-200" 
                    onMouseEnter={() => setHoveredFeature('widget')}
                    onMouseLeave={() => setHoveredFeature(null)}
                    style={{ 
                      opacity: hoveredFeature && hoveredFeature !== 'widget' ? 0.2 : 1 
                    }}
                  >
                    <div className="h-8 w-8 rounded-md bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mr-3">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-sm">Easily install feedback widget</p>
                    </div>
                  </div>
                  
                  <div 
                    className="flex items-center transition-opacity duration-200"
                    onMouseEnter={() => setHoveredFeature('guarantee')}
                    onMouseLeave={() => setHoveredFeature(null)}
                    style={{ 
                      opacity: hoveredFeature && hoveredFeature !== 'guarantee' ? 0.2 : 1 
                    }}
                  >
                    <div className="h-8 w-8 rounded-md bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 flex items-center justify-center mr-3">
                      <Rocket className="h-4 w-4" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-sm">Get more user feedback within a day or I'll pay you $20</p>
                    </div>
                  </div>
                  
                  <div 
                    className="flex items-center transition-opacity duration-200"
                    onMouseEnter={() => setHoveredFeature('slack')}
                    onMouseLeave={() => setHoveredFeature(null)}
                    style={{ 
                      opacity: hoveredFeature && hoveredFeature !== 'slack' ? 0.2 : 1 
                    }}
                  >
                    <div className="h-8 w-8 rounded-md bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 flex items-center justify-center mr-3">
                      <Slack className="h-4 w-4" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-sm">Manage feedback directly from Slack</p>
                    </div>
                  </div>
                </div>
                
                <Button 
                  className="w-full max-w-sm mx-auto group" 
                  onClick={handleStep1Next}
                  autoFocus
                >
                Get started
                  <span className="ml-2 text-xs text-primary-foreground/70 group-hover:text-primary-foreground/90 transition-colors">
                    Enter
                  </span>
              </Button>
            </div>
          )}

          {step === 2 && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (productName.trim() && !backgroundCreating && !isCreating) {
                      handleWorkspaceCreation();
                    }
                  }}
                  id="workspace-form"
                >
                  <h2 className="text-2xl font-semibold text-center mb-2">Create your workspace</h2>
                  <p className="text-muted-foreground text-center mb-6">
                Manage your customer support and feedback hub in a shared workspace with your team.
              </p>
                  <div className="space-y-2 mb-6 max-w-sm mx-auto">
                <label htmlFor="product-name" className="text-sm font-medium">
                  Product/company name
                </label>
                <Input
                  id="product-name"
                  value={productName}
                  onChange={(e) => {
                    setProductName(e.target.value);
                    setBackgroundError(null);
                  }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          e.stopPropagation();
                          if (productName.trim() && !backgroundCreating && !isCreating) {
                            handleWorkspaceCreation();
                          }
                        }
                      }}
                  placeholder="e.g., Acme Inc."
                      autoFocus
                />
              </div>
              <div className="max-w-sm mx-auto">
                <Button 
                      type="submit"
                    className="w-full group" 
                      disabled={!productName.trim() || backgroundCreating || isCreating}
                  >
                      {backgroundCreating || isCreating ? (
                        <><Loader className="mr-2 h-4 w-4 animate-spin" />Creating workspace...</>
                    ) : (
                        <>Create workspace
                        <span className="ml-2 text-xs text-primary-foreground/70 group-hover:text-primary-foreground/90 transition-colors">
                          Enter
                        </span>
                      </>
                    )}
                  </Button>
                  {backgroundError && (
                    <div className="text-destructive text-sm mt-2">{backgroundError}</div>
                  )}
                </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}