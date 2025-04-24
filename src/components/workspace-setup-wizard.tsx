import { useState, useEffect, KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { toast } from 'sonner'
import { Loader, Bird, ArrowLeft, Info } from 'lucide-react'

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

  const handleNext = () => {
    console.log('handleNext called, current step:', step);
    // Don't proceed if product name is empty at step 2
    if (step === 2 && !productName.trim()) {
      console.log('Product name empty, showing error');
      toast.error('Please enter a product or company name');
      return;
    }
    console.log('Moving to next step:', step + 1);
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
          toast.error('Please enter a product or company name');
        }
      } else if (step === 3) {
        // Only handle Enter if we're not already creating a workspace
        if (!isCreating) {
          console.log('Step 3 Enter key handler triggered');
          handleCreateWorkspace();
        } else {
          console.log('Step 3 Enter key handler not triggered (isCreating is true)');
        }
      }
    }
  };

  // Direct click handler for first step button
  const handleStep1Next = () => {
    console.log('handleStep1Next called directly');
    handleNext();
  };

  const handleCreateWorkspace = async () => {
    if (!productName.trim()) {
      toast.error('Please enter a product or company name');
      return;
    }

    setIsCreating(true);
    console.log('Creating workspace with:', { productName, userId: user?.id, helpDocsUrl });

    try {
      // Generate a random ID in the same format as existing IDs
      const formId = generateShortId();
      
      // Create the form without help_docs_url and without a dummy URL
      const formData = {
        id: formId,
        product_name: productName,
        owner_id: user?.id
        // URL is optional, so we don't include it
      };
            
      console.log('Creating form with data:', formData);
      
      const insertResult = await supabase
        .from('forms')
        .insert(formData)
        .select('id')
        .single();

      console.log('Insert result:', insertResult);
      
      // Extract data and error from result
      const { data, error } = insertResult;

      if (error) {
        console.error('Detailed error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }

      // If help docs URL was provided, create a scraping process
      if (data?.id && helpDocsUrl.trim()) {
        try {
          console.log('Creating docs scraping process for URL:', helpDocsUrl);
          
          // Create a docs_scraping_process record
          const { data: processData, error: processError } = await supabase
            .from('docs_scraping_processes')
            .insert({
              form_id: formId,
              base_url: helpDocsUrl,
              status: 'in_progress'
            })
            .select()
            .single();
            
          if (processError) {
            console.error('Error creating docs scraping process:', processError);
            // Don't throw here, we want to continue even if docs scraping fails
          } else {
            console.log('Docs scraping process created:', processData);
          }
          
          // Call the start-crawl Netlify function directly
          console.log('Calling start-crawl function with URL:', helpDocsUrl, 'and form ID:', formId);
          try {
            const startCrawlResponse = await fetch('/.netlify/functions/start-crawl', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                url: helpDocsUrl,
                form_id: formId
              }),
            });
            
            if (!startCrawlResponse.ok) {
              const errorText = await startCrawlResponse.text();
              console.error('Start crawl failed with status:', startCrawlResponse.status, 'Response:', errorText);
            } else {
              const responseData = await startCrawlResponse.json();
              console.log('Start crawl successful. Response:', responseData);
            }
          } catch (crawlError) {
            console.error('Error starting crawl process:', crawlError);
            // Don't throw here, we want to continue even if crawl fails
          }
        } catch (docsError) {
          console.error('Error in docs scraping setup:', docsError);
          // Continue anyway, the form is created successfully
        }
      }

      // Navigate to the newly created form
      if (data?.id) {
        console.log('Form created successfully with ID:', data.id);
        
        // Store form ID in localStorage to remember last form
        if (user?.id) {
          localStorage.setItem(`userbird-last-form-${user.id}`, data.id);
          console.log('Saved form ID to localStorage');
        }
        
        // First show success message
        toast.success('Workspace created successfully');
        
        // Call onComplete to signal the parent component
        onComplete();
        
        // Use window.location for hard navigation instead of React Router
        setTimeout(() => {
          console.log('Hard navigating to form:', data.id);
          window.location.href = `/forms/${data.id}`;
        }, 300); // Increased timeout to ensure toast is shown
      } else {
        console.error('No data returned after insert');
        toast.error('Failed to create workspace. No ID returned.');
      }
    } catch (error: any) {
      console.error('Error creating workspace:', error);
      toast.error(`Failed to create workspace: ${error.message || 'Please try again'}`);
    } finally {
      setIsCreating(false);
    }
  };

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
      
      <div className="bg-background rounded-lg shadow-lg border w-full max-w-md p-6 transition-all duration-500 ease-in-out">
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
              <Button 
                className="w-full group" 
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
                <div className="space-y-2 mb-6">
                  <label htmlFor="product-name" className="text-sm font-medium">
                    Product/company name
                  </label>
                  <Input
                    id="product-name"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="e.g., Acme Inc."
                    autoFocus
                  />
                </div>
                <Button 
                  className="w-full group" 
                  onClick={handleNext}
                  disabled={!productName.trim()}
                >
                  Continue
                  <span className="ml-2 text-xs text-primary-foreground/70 group-hover:text-primary-foreground/90 transition-colors">
                    Enter
                  </span>
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mb-6">
                <button 
                  type="button"
                  onClick={handleBack}
                  className="text-sm text-muted-foreground hover:text-foreground flex items-center mb-3 transition-colors"
                >
                  <ArrowLeft className="h-3 w-3 mr-1" />
                  <span>Back</span>
                </button>
                <h2 className="text-2xl font-semibold text-center">Connect your help docs</h2>
              </div>
              
              <div className="bg-muted/50 p-4 rounded-lg mb-6 flex items-start">
                <Info className="h-5 w-5 text-primary mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <p className="text-sm mb-2 font-medium">Why connect your help docs?</p>
                  <p className="text-sm text-muted-foreground">
                    Connecting your documentation helps Userbird automatically suggest relevant articles to your users, reducing support volume and improving user experience.
                  </p>
                </div>
              </div>

              <div className="space-y-2 mb-6">
                <label htmlFor="help-docs-url" className="text-sm font-medium">
                  Documentation URL
                </label>
                <Input
                  id="help-docs-url"
                  value={helpDocsUrl}
                  onChange={(e) => setHelpDocsUrl(e.target.value)}
                  placeholder="https://docs.yourapp.com"
                  disabled={isCreating}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  We support most documentation platforms including Gitbook, Notion, and custom docs.
                </p>
              </div>

              <div className="flex gap-3">
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
        </div>
      </div>
    </div>
  )
} 