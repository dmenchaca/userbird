import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { toast } from 'sonner'
import { Loader } from 'lucide-react'

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
  const [isCreating, setIsCreating] = useState(false)
  const navigate = useNavigate()
  const { user } = useAuth()

  // Check if URL is actually optional in the database schema
  useEffect(() => {
    const checkDatabaseSchema = async () => {
      try {
        // Use a raw SQL query to check table constraints
        const { data, error } = await supabase.rpc('debug_table_schema', { table_name: 'forms' });
        
        if (error) {
          console.error('Error checking schema:', error);
          return;
        }
        
        console.log('Forms table schema:', data);

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
    setStep(step + 1)
  }

  const handleCreateWorkspace = async () => {
    if (!productName.trim()) {
      toast.error('Please enter a product or company name')
      return
    }

    setIsCreating(true)
    console.log('Creating workspace with:', { productName, userId: user?.id })

    try {
      // Generate a placeholder URL in case it's still required in the database
      const placeholderUrl = productName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now()
      
      // Generate a random ID in the same format as existing IDs
      const formId = generateShortId();
      
      // Include the ID in the form data
      const formData = {
        id: formId,
        product_name: productName,
        owner_id: user?.id
      }
      
      // Fallback data with URL in case the migration hasn't applied
      const fallbackFormData = {
        ...formData,
        url: placeholderUrl
      }
      
      console.log('Attempting to create form without URL:', formData)
      
      // First try without URL
      let insertResult = await supabase
        .from('forms')
        .insert(formData)
        .select('id')
        .single()

      console.log('First insert attempt result:', insertResult)

      // If that fails, try with URL as fallback
      if (insertResult.error) {
        if (insertResult.error.message.includes('violates not-null constraint')) {
          console.log('URL still required, trying with placeholder URL')
          insertResult = await supabase
            .from('forms')
            .insert(fallbackFormData)
            .select('id')
            .single()
            
          console.log('Fallback insert result:', insertResult)
        }
      }
      
      // Extract data and error from result
      const { data, error } = insertResult

      if (error) {
        console.error('Detailed error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        throw error
      }

      // Navigate to the newly created form
      if (data?.id) {
        console.log('Form created successfully with ID:', data.id)
        
        // Store form ID in localStorage to remember last form
        if (user?.id) {
          localStorage.setItem(`userbird-last-form-${user.id}`, data.id)
          console.log('Saved form ID to localStorage')
        }
        
        // Call onComplete and then navigate to the newly created form
        onComplete()
        toast.success('Workspace created successfully')
        navigate(`/forms/${data.id}`)
      } else {
        console.error('No data returned after insert')
        toast.error('Failed to create workspace. No ID returned.')
      }
    } catch (error) {
      console.error('Error creating workspace:', error)
      toast.error('Failed to create workspace. Please try again.')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-lg shadow-lg border w-full max-w-md p-6">
        {step === 1 && (
          <div className="space-y-6 text-center">
            <h2 className="text-2xl font-semibold">Welcome to Userbird</h2>
            <p className="text-muted-foreground">
              Set up your new customer support and feedback system.
            </p>
            <Button className="w-full" onClick={handleNext}>
              Get started
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-center">Create your workspace</h2>
            <p className="text-muted-foreground text-center">
              Manage your customer support and feedback hub in a shared workspace with your team.
            </p>
            <div className="space-y-2">
              <label htmlFor="product-name" className="text-sm font-medium">
                Product/company name
              </label>
              <Input
                id="product-name"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g., Acme Inc."
                disabled={isCreating}
              />
            </div>
            <Button 
              className="w-full" 
              onClick={handleCreateWorkspace} 
              disabled={isCreating}
            >
              {isCreating ? (
                <>
                  <Loader className="mr-2 h-4 w-4 animate-spin" />
                  Creating workspace...
                </>
              ) : 'Create workspace'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
} 