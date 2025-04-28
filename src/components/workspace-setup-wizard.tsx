import { useState, useEffect, KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { Loader, Bird, ArrowLeft, Info, Copy, Mail, ExternalLink, Check, MessageSquareQuote } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { createSampleFeedback } from '@/lib/sample-feedback'

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

export function WorkspaceSetupWizard({ onComplete }: WorkspaceSetupWizardProps) {
  const [step, setStep] = useState(1)
  const [productName, setProductName] = useState('')
  const [helpDocsUrl, setHelpDocsUrl] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const { user } = useAuth()
  const [createdFormId, setCreatedFormId] = useState<string | null>(null)
  const [backgroundCreating, setBackgroundCreating] = useState(false)
  const [backgroundError, setBackgroundError] = useState<string | null>(null)
  const [formDefaultEmail, setFormDefaultEmail] = useState<string | null>(null)
  const [installCopied, setInstallCopied] = useState(false)
  const [hoveredSection, setHoveredSection] = useState<'email' | 'feedback' | null>(null)
  const navigate = useNavigate()
  
  // Add new state variables for the loading animation steps
  const [loadingStep, setLoadingStep] = useState(0)
  const loadingSteps = [
    "Creating your workspace",
    "Loading sample support tickets",
    "Enabling AI to auto-label your feedback"
  ]
  
  console.log('Rendering WorkspaceSetupWizard, current step:', step);
  
  // Get user's first name for the welcome message
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 
                   user?.user_metadata?.name?.split(' ')[0] || 
                   user?.email?.split('@')[0] || 
                   'there'

  useEffect(() => {
    // Focus the container on mount to ensure it can receive keyboard events
    console.log('Setting up initial focus');
    const container = document.getElementById('wizard-container');
    if (container) {
      container.focus();
      console.log('Focused wizard container');
    }
  }, []);

  // Check if URL is actually optional in the database schema
  useEffect(() => {
    const checkDatabaseSchema = async () => {
      try {
        // Skip the debug_table_schema call as it's causing errors
        console.log('Skipping schema check and trying direct test insert');

        // Fallback method - try a simple insert without URL
        const testData = {
          id: generateShortId(), // Generate a random ID similar to existing format
          product_name: 'Test Product',
          owner_id: user?.id
        };
        
        console.log('Testing insert without URL:', testData);
        
        const { data: testInsert, error: insertError } = await supabase
          .from('forms')
          .insert(testData)
          .select()
          .single();
          
        console.log('Test insert result:', { data: testInsert, error: insertError });
        
        // Clean up test data
        if (testInsert) {
          const { error: deleteError } = await supabase
            .from('forms')
            .delete()
            .eq('id', testInsert.id);
            
          console.log('Test data cleanup:', { error: deleteError });
        }
      } catch (e) {
        console.error('Schema check failed:', e);
      }
    };

    if (user?.id) {
      checkDatabaseSchema();
    }
  }, [user?.id]);

  // Fetch default_email for the created form when step 3 is reached
  useEffect(() => {
    const fetchDefaultEmail = async () => {
      if (createdFormId && step === 3) {
        const { data, error } = await supabase
          .from('forms')
          .select('default_email')
          .eq('id', createdFormId)
          .single();
        if (!error && data?.default_email) {
          setFormDefaultEmail(data.default_email);
        }
      }
    };
    fetchDefaultEmail();
  }, [createdFormId, step]);

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

  // Fetch product name for any step >= 2 if form exists (including after going back from step 1)
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

  // HTML/JS install instructions (from InstallInstructionsModal, only HTML/JS version)
  const installInstructions = `<!-- Option A: Simple text button -->\n<button id=\"userbird-trigger-${createdFormId || 'FORM_ID'}\">Feedback</button>\n\n<!-- Option B: Button with icon and text -->\n<button id=\"userbird-trigger-${createdFormId || 'FORM_ID'}\" class=\"flex items-center gap-2\">\n  <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">\n    <path d=\"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z\"></path>\n  </svg>\n  <span>Feedback</span>\n  <span class=\"badge\">F</span>\n</button>\n\n<!-- Initialize Userbird - Place this before the closing </body> tag -->\n<script>\n  (function(w,d,s) {\n    w.UserBird = w.UserBird || {};\n    w.UserBird.formId = \"${createdFormId || 'FORM_ID'}\";\n\n    // Optional: Add user information\n    w.UserBird.user = {\n      id: 'user-123',                 // Your user's ID\n      email: 'user@example.com',      // User's email\n      name: 'John Doe'                // User's name\n    };\n\n    s = d.createElement('script');\n    s.src = 'https://userbird.netlify.app/widget.js';\n    s.async = 1;\n    d.head.appendChild(s);\n  })(window, document);\n</script>`;

  const handleCopyInstall = async () => {
    try {
      await navigator.clipboard.writeText(installInstructions)
      setInstallCopied(true)
      setTimeout(() => setInstallCopied(false), 2000)
    } catch {
      console.error('Failed to copy instructions')
    }
  }

  const handleEmailInstall = () => {
    const subject = encodeURIComponent('Userbird Feedback Button Install Instructions')
    const body = encodeURIComponent(
      `Hi,\n\nHere are the install instructions for the Userbird feedback button.\n\n${installInstructions}\n\nLet me know if you have any questions!`
    )
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank')
  }

  const handleSendTestEmail = () => {
    if (formDefaultEmail) {
      window.open(
        `mailto:${formDefaultEmail}?subject=Test%20support%20email%20to%20Userbird`,
        '_blank'
      );
    }
  }

  // Background form creation or patch for step 2
  const handleBackgroundFormCreationOrPatch = async (name: string) => {
    if (backgroundCreating) return; // Prevent duplicate
    setBackgroundCreating(true);
    setBackgroundError(null);
    try {
      if (createdFormId) {
        // Patch the existing form's name
        const { error: updateError } = await supabase
          .from('forms')
          .update({ product_name: name })
          .eq('id', createdFormId)
          .select();
        if (updateError) throw updateError;
      } else {
        // Create a new form
        const formId = generateShortId();
        const formData = {
          id: formId,
          product_name: name,
          owner_id: user?.id
        };
        const insertResult = await supabase
          .from('forms')
          .insert(formData)
          .select('id')
          .single();
        const { data, error } = insertResult;
        if (error) throw error;
        
        // Create default tags for the new form
        await createDefaultTags(formId);
        
        if (data?.id && user?.id && user?.email) {
          await supabase
            .from('form_collaborators')
            .insert({
              form_id: formId,
              user_id: user.id,
              role: 'admin',
              invited_by: user.id,
              invitation_email: user.email,
              invitation_accepted: true
            })
            .select()
            .single();
        }
        setCreatedFormId(data?.id);
        if (user?.id && data?.id) {
          localStorage.setItem(`userbird-last-form-${user.id}`, data.id);
        }
      }
    } catch (err: any) {
      setBackgroundError(err.message || 'Failed to create or update workspace');
      if (!createdFormId) setCreatedFormId(null);
    } finally {
      setBackgroundCreating(false);
    }
  };

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

  const handleNext = () => {
    console.log('handleNext called, current step:', step);
    if (step === 2 && !productName.trim()) {
      console.log('Product name empty, showing error');
      return;
    }
    // On step 2, fire background creation or patch
    if (step === 2 && productName.trim()) {
      handleBackgroundFormCreationOrPatch(productName.trim());
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    console.log('handleBack called, moving from step', step, 'to', step - 1);
    setStep(step - 1);
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLDivElement | HTMLFormElement>) => {
    console.log('Key pressed in global handler:', e.key, 'Current step:', step, 'Target:', e.target);
    if (e.key === 'Enter') {
      console.log('Enter key detected in global handler');
      e.preventDefault();
      
      if (step === 1) {
        console.log('Step 1 Enter key handler triggered');
        handleNext();
      } else if (step === 2) {
        if (productName.trim()) {
          console.log('Step 2 Enter key handler triggered with valid product name');
          handleNext();
        } else {
          console.log('Step 2 Enter key handler triggered with empty product name');
        }
      } else if (step === 3) {
        // On step 3, Enter should advance to step 4, not finish the onboarding
        console.log('Step 3 Enter key handler triggered');
        handleNext();
      } else if (step === 4) {
        // Only handle Enter if we're not already creating a workspace
        if (!isCreating) {
          console.log('Step 4 Enter key handler triggered');
          handleCreateWorkspace();
        } else {
          console.log('Step 4 Enter key handler not triggered (isCreating is true)');
        }
      }
      // No action needed for step 5 (loading animation)
    }
  };

  // Direct click handler for first step button
  const handleStep1Next = () => {
    console.log('handleStep1Next called directly');
    handleNext();
  };

  // Onboarding completion: set completed flag and clear step state
  const markOnboardingComplete = () => {
    if (!user?.id) return;
    const completedKey = `userbird-onboarding-completed-${user.id}`;
    const stepKey = `userbird-onboarding-step-${user.id}`;
    localStorage.setItem(completedKey, 'true');
    localStorage.removeItem(stepKey);
  };

  // In handleCreateWorkspace, after successful onboarding, mark as complete and move to step 5
  const handleCreateWorkspace = async () => {
    if (!productName.trim()) {
      return;
    }
    // If background creation failed, try again
    if (!createdFormId && !backgroundCreating) {
      await handleBackgroundFormCreationOrPatch(productName.trim());
      if (!createdFormId) {
        return;
      }
    }
    setIsCreating(true);
    
    // Move to step 5 immediately
    setStep(5);
    
    // Reset loading step counter
    setLoadingStep(0);
    
    try {
      // If help docs URL was provided, create a scraping process
      if (createdFormId && helpDocsUrl.trim()) {
        try {
          await supabase
            .from('docs_scraping_processes')
            .insert({
              form_id: createdFormId,
              base_url: helpDocsUrl,
              status: 'in_progress'
            })
            .select()
            .single();
          await fetch('/.netlify/functions/start-crawl', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: helpDocsUrl, form_id: createdFormId })
          });
        } catch (docsError) {
          // Continue anyway
        }
      }
      
      // Simulate first step completion
      setLoadingStep(1);
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Create sample feedback for the new workspace
      if (createdFormId) {
        try {
          await createSampleFeedback(createdFormId);
        } catch (sampleError) {
          console.error('Error creating sample feedback:', sampleError);
          // Continue even if sample feedback creation fails
        }
      }
      
      // Simulate second step completion
      setLoadingStep(2);
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Mark onboarding as complete
      markOnboardingComplete();
      onComplete();
      
      // Simulate third step completion
      setLoadingStep(3);
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // Redirect to the dashboard
      window.location.href = `/forms/${createdFormId}`;
    } catch (error: any) {
      console.error(`Failed to create workspace: ${error.message || 'Please try again'}`);
      // Even on error, still redirect
      markOnboardingComplete();
      onComplete();
      window.location.href = `/forms/${createdFormId}`;
    } finally {
      setIsCreating(false);
    }
  };

  // Utility to clear onboarding state for the current user
  function clearOnboardingState(userId: string) {
    localStorage.removeItem(`userbird-onboarding-step-${userId}`);
    localStorage.removeItem(`userbird-onboarding-completed-${userId}`);
    localStorage.removeItem(`userbird-last-form-${userId}`);
  }

  // On mount, if there are no forms, clear onboarding state and reset
  useEffect(() => {
    if (!user?.id) return;
    const checkUserForms = async () => {
      const { data } = await supabase
        .from('form_collaborators')
        .select('form_id')
        .eq('user_id', user.id);
      if (!data || data.length === 0) {
        clearOnboardingState(user.id);
        setStep(1);
        setCreatedFormId(null);
        setProductName('');
        setHelpDocsUrl('');
      }
    };
    checkUserForms();
  }, [user?.id]);

  // On mount and when createdFormId changes, check if the referenced form exists
  useEffect(() => {
    if (!user?.id) return;
    if (!createdFormId) return;
    const checkFormExists = async () => {
      const { data } = await supabase
        .from('forms')
        .select('id')
        .eq('id', createdFormId)
        .single();
      if (!data) {
        // Form no longer exists, clear onboarding state and reset
        clearOnboardingState(user.id);
        setStep(1);
        setCreatedFormId(null);
        setProductName('');
        setHelpDocsUrl('');
      }
    };
    checkFormExists();
  }, [createdFormId, user?.id]);

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
      
      <div className={`flex flex-col items-end w-full ${step === 3 ? 'max-w-[52rem]' : 'max-w-xl'}`}>
        {/* Header flex container with back button and feedback button */}
        <div className="mb-4 w-full flex justify-between items-center">
          {/* Back button - only show on steps 2, 3, 4 (not on 1 or 5) */}
          {step > 1 && step < 5 && (
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
        
        <div className="bg-background rounded-lg shadow-lg border w-full p-8 py-10 transition-all duration-500 ease-in-out">
          <div>
        {step === 1 && (
              <div 
                className="text-center animate-in fade-in slide-in-from-bottom-4 duration-500"
                onKeyDown={(e) => {
                  console.log('Key pressed in step 1 specific handler:', e.key);
                  if (e.key === 'Enter') {
                    console.log('Enter pressed in step 1 specific handler');
                    e.preventDefault();
                    e.stopPropagation();
                    handleNext();
                  }
                }}
              >
            <div className="flex justify-center pb-4">
              <a href="/" className="flex items-center gap-2 font-medium">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Bird className="h-4 w-4" />
                </div>
                Userbird
              </a>
            </div>
                <div className="space-y-2 mb-6">
            <h2 className="text-2xl font-semibold">Hi {firstName}, welcome to Userbird 🎉</h2>
            <p className="text-muted-foreground">
              Set up your new customer support and feedback system.
            </p>
                </div>
                
                <div className="mb-6" style={{ position: "relative", paddingBottom: "56.25%", height: 0, backgroundColor: "#f5f5f5", borderRadius: "8px" }}>
                  {/* Thumbnail placeholder that shows immediately */}
                  <div 
                    style={{ 
                      position: "absolute", 
                      top: 0, 
                      left: 0, 
                      width: "100%", 
                      height: "100%", 
                      backgroundImage: "url('https://cdn.loom.com/sessions/thumbnails/2972dfe00ea24bf5b0f39d0ee8d7bdd1-with-play.jpg')", 
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <div style={{ 
                      width: "64px", 
                      height: "64px", 
                      borderRadius: "50%", 
                      backgroundColor: "rgba(0,0,0,0.7)", 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "center" 
                    }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M8 5V19L19 12L8 5Z" fill="white" />
                      </svg>
                    </div>
                  </div>
                  <iframe 
                    src="https://www.loom.com/embed/2972dfe00ea24bf5b0f39d0ee8d7bdd1?sid=c5b01737-eb77-4bc8-bc41-e391a2c7ecd5&hide_owner=true&hide_share=true&hide_title=true&hideEmbedTopBar=true"
                    frameBorder="0" 
                    allowFullScreen 
                    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", borderRadius: "8px" }}
                    loading="lazy"
                  />
                </div>
                
                <Button 
                  className="w-full max-w-sm mx-auto group" 
                  onClick={handleStep1Next}
                  autoFocus // Auto focus the button to capture keyboard events
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
                <div>
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
                  placeholder="e.g., Acme Inc."
                      autoFocus
                />
              </div>
              <div className="max-w-sm mx-auto">
                <Button 
                    className="w-full group" 
                    onClick={handleNext}
                    disabled={!productName.trim() || backgroundCreating}
                  >
                    {backgroundCreating ? (
                      <><Loader className="mr-2 h-4 w-4 animate-spin" />Saving...</>
                    ) : (
                      <>Continue
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
                </div>
              </div>
            )}

            {step === 3 && (
              <div 
                className="animate-in fade-in slide-in-from-bottom-4 duration-500"
                onKeyDown={(e) => {
                  console.log('Key pressed in step 3 specific handler:', e.key);
                  if (e.key === 'Enter') {
                    console.log('Enter pressed in step 3 specific handler');
                    e.preventDefault();
                    e.stopPropagation();
                    handleNext();
                  }
                }}
                tabIndex={0} // Make div focusable to capture key events
              >
                <div className="mb-5">
                  <h2 className="text-2xl font-semibold text-center mb-1">How to get feedback and support tickets into Userbird</h2>
                </div>
                
                <div className="my-16">
                  <div className="flex flex-col md:flex-row">
                    {/* Email Support Side */}
                    <div 
                      className={`flex-1 mb-6 md:mb-0 transition-opacity duration-200 ${
                        hoveredSection === 'feedback' ? 'opacity-20' : hoveredSection === 'email' ? 'opacity-100' : 'opacity-100'
                      }`}
                      onMouseEnter={() => setHoveredSection('email')}
                      onMouseLeave={() => setHoveredSection(null)}
                    >
                      <div className="flex items-center mb-5">
                        <div className="h-8 w-8 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center mr-3">
                          <Mail className="h-4 w-4" />
                        </div>
                        <h3 className="font-medium">Support via email</h3>
                      </div>
                      
                      <div className="mb-4">
                        <label className="block text-sm text-muted-foreground mb-1.5">Your support email address:</label>
                        <div className="flex flex-col space-y-3">
                          <div className="w-full relative group">
                            <div className="absolute inset-0 border rounded-md transition-colors pointer-events-none"></div>
                            <input 
                              type="text" 
                              readOnly 
                              value={formDefaultEmail || '...'}
                              className="w-full bg-slate-50 py-2 rounded-md font-mono text-sm text-left focus:outline-none"
                              style={{ padding: '8px 12px' }}
                            />
                          </div>
                          <Button 
                            variant="outline"
                            onClick={handleSendTestEmail} 
                            disabled={!formDefaultEmail}
                            className="whitespace-nowrap w-full h-9 px-4 py-2"
                          >
                            Send test email
                            <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="bg-blue-50 text-blue-700 text-xs p-3 rounded-md flex">
                        <Info className="h-4 w-4 text-blue-600 mr-2 flex-shrink-0" />
                        <span>You can customize this email address later in your workspace settings.</span>
                      </div>
                    </div>
                    
                    {/* Vertical Divider */}
                    <div className="hidden md:block w-px bg-slate-200 mx-12"></div>
                    
                    {/* Feedback Button Side */}
                    <div 
                      className={`flex-1 transition-opacity duration-200 ${
                        hoveredSection === 'email' ? 'opacity-20' : hoveredSection === 'feedback' ? 'opacity-100' : 'opacity-100'
                      }`}
                      onMouseEnter={() => setHoveredSection('feedback')}
                      onMouseLeave={() => setHoveredSection(null)}
                    >
                      <div className="flex items-center mb-5">
                        <div className="h-8 w-8 rounded-md bg-purple-50 text-purple-600 flex items-center justify-center mr-3">
                          <MessageSquareQuote className="h-4 w-4" />
                        </div>
                        <h3 className="font-medium">Feedback button integration</h3>
                      </div>
                      
                      <p className="text-sm text-slate-600 mb-5">
                        Add a feedback button to your product so users can easily share their feedback.
                      </p>
                      
                      <div className="grid grid-cols-1 grid-rows-2 gap-3">
                        <Button 
                          onClick={handleCopyInstall}
                          variant="outline"
                          className="border-purple-200 hover:border-purple-300 bg-purple-50 hover:bg-purple-100/70"
                        >
                          {installCopied ? (
                            <div className="flex items-center">
                              <Check className="h-4 w-4 mr-2 text-green-600" />
                              <span>Copied!</span>
                            </div>
                          ) : (
                            <div className="flex items-center">
                              <Copy className="h-4 w-4 mr-2 text-purple-600" />
                              <span>Copy install code</span>
                            </div>
                          )}
                        </Button>
                        
                        <Button 
                          onClick={handleEmailInstall}
                          variant="outline"
                          className="border-slate-200"
                        >
                          <span>Email to developer</span>
                          <ExternalLink className="ml-1.5 h-3.5 w-3.5 opacity-70" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center mt-10">
                  <Button 
                    onClick={handleNext} 
                    className="w-full max-w-sm mx-auto group"
                    autoFocus // Auto focus this button when step 3 renders to ensure keyboard navigation works
                  >
                    Continue
                    <span className="ml-2 text-xs text-primary-foreground/70 group-hover:text-primary-foreground/90 transition-colors">
                      Enter
                    </span>
                  </Button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-6">
                  <h2 className="text-2xl font-semibold text-center">Manage feedback at blazing speed 🚀</h2>
                </div>

                <div className="space-y-2 mb-6 max-w-sm mx-auto">
                  <label htmlFor="help-docs-url" className="text-sm font-medium">
                    {productName ? `${productName}'s help docs` : "Your product's knowledge base"}
                  </label>
                  <Input
                    id="help-docs-url"
                    value={helpDocsUrl}
                    onChange={(e) => setHelpDocsUrl(e.target.value)}
                    placeholder="https://help.yourapp.com"
                    disabled={isCreating}
                    autoFocus
                  />
                </div>

                {/* Callout below the field, as wide as the field and CTA, using mixed terminology */}
                <div className="bg-muted/50 p-4 rounded-lg mb-6 flex items-start max-w-sm mx-auto">
                  <Info className="h-5 w-5 text-primary mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <p className="text-sm mb-0 font-medium">Why connect your documentation?</p>
                    <p className="text-sm text-muted-foreground mb-0">
                      We use your knowledge base to help you speed up support.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 max-w-sm mx-auto">
                  <Button 
                    type="button"
                    variant="outline" 
                    onClick={handleCreateWorkspace} 
                    disabled={isCreating}
                    className="flex-1"
                  >
                    Skip for now
                  </Button>
                  <Button 
                    type="button"
                    className="flex-1 group" 
                    onClick={handleCreateWorkspace} 
                    disabled={isCreating}
                  >
                    {isCreating ? (
                      <>
                        <Loader className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        Create workspace
                        <span className="ml-2 text-xs text-primary-foreground/70 group-hover:text-primary-foreground/90 transition-colors">
                          Enter
                        </span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-10">
                  <h2 className="text-2xl font-semibold text-center">Setting up your workspace</h2>
                  <p className="text-center text-muted-foreground mt-2">
                    This will only take a moment...
                  </p>
                </div>

                <div className="space-y-6 max-w-md mx-auto">
                  {loadingSteps.map((step, index) => (
                    <div 
                      key={index} 
                      className={`flex items-center transition-opacity duration-300 ${
                        loadingStep < index ? 'opacity-40' : 'opacity-100'
                      }`}
                    >
                      <div className="mr-4 h-8 w-8 flex-shrink-0">
                        {loadingStep > index ? (
                          <div className="rounded-full h-8 w-8 bg-primary/10 text-primary flex items-center justify-center">
                            <Check className="h-5 w-5" />
                          </div>
                        ) : loadingStep === index ? (
                          <div className="rounded-full h-8 w-8 border-2 border-primary/30 border-t-primary animate-[spin_0.6s_linear_infinite]"></div>
                        ) : (
                          <div className="rounded-full h-8 w-8 border-2 border-muted"></div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className={`font-medium ${loadingStep >= index ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {step}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}