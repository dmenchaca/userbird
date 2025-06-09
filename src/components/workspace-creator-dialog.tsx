import React, { useState, useEffect } from 'react'
import { nanoid } from 'nanoid'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { toast } from 'sonner'
import { trackEvent } from '@/lib/posthog'
import { X } from 'lucide-react'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { Label } from './ui/label'
import { createSampleFeedback } from '@/lib/sample-feedback'

interface WorkspaceCreatorDialogProps {
  open: boolean
  onClose: () => void
}

export function WorkspaceCreatorDialog({ open, onClose }: WorkspaceCreatorDialogProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [productName, setProductName] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [dialogElement, setDialogElement] = useState<HTMLDivElement | null>(null)

  // Manage the dialog visibility
  useEffect(() => {
    // On mount or when dialog state changes
    if (dialogElement) {
      if (open) {
        // Show dialog
        dialogElement.style.display = 'flex'
        // Add class to prevent scrolling on body
        document.body.classList.add('overflow-hidden')
        
        // Focus the first input after a short delay
        setTimeout(() => {
          const input = dialogElement.querySelector('input') as HTMLInputElement
          if (input) input.focus()
        }, 50)
      } else {
        // Hide dialog
        dialogElement.style.display = 'none'
        // Re-enable scrolling
        document.body.classList.remove('overflow-hidden')
        // Ensure any elements with aria-hidden are reset
        document.querySelectorAll('[aria-hidden="true"]').forEach(el => {
          if (el instanceof HTMLElement) {
            el.removeAttribute('aria-hidden')
            el.removeAttribute('data-aria-hidden')
          }
        })
      }
    }
    
    // Cleanup function
    return () => {
      document.body.classList.remove('overflow-hidden')
      // Ensure any elements with aria-hidden are reset on unmount
      document.querySelectorAll('[aria-hidden="true"]').forEach(el => {
        if (el instanceof HTMLElement) {
          el.removeAttribute('aria-hidden')
          el.removeAttribute('data-aria-hidden')
        }
      })
    }
  }, [open, dialogElement])

  // Handle clicking outside the dialog to close it
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dialogElement && open) {
        const dialogContent = dialogElement.querySelector('.dialog-content')
        if (dialogContent && !dialogContent.contains(e.target as Node)) {
          // Clicked outside the dialog content
          handleClose()
        }
      }
    }
    
    // Add and remove event listeners
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open, dialogElement])

  // Handle ESC key to close the dialog
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        handleClose()
      }
    }
    
    // Add and remove event listeners
    if (open) {
      document.addEventListener('keydown', handleEscKey)
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscKey)
    }
  }, [open])

  const handleClose = () => {
    // If there are changes, confirm before closing
    if (productName.trim()) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        resetDialog()
        onClose()
      }
    } else {
      resetDialog()
      onClose()
    }
  }

  const resetDialog = () => {
    setProductName('')
    setError('')
    // Blur any focused element
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
  }

  // Function to create default tags for a new form
  const createDefaultTags = async (formId: string) => {
    try {
      const defaultTags = [
        { name: 'Bug', color: '#EF4444', is_favorite: true },        // Red
        { name: 'Data loss', color: '#64748B', is_favorite: true },  // Grey
        { name: 'Glitch', color: '#EAB308', is_favorite: true },     // Yellow
        { name: 'New feature', color: '#10B981', is_favorite: true }, // Green
        { name: 'Love it', color: '#EC4899', is_favorite: true }     // Pink
      ]
      
      const { error } = await supabase
        .from('feedback_tags')
        .insert(defaultTags.map(tag => ({
          name: tag.name,
          color: tag.color,
          form_id: formId,
          is_favorite: tag.is_favorite
        })))
        
      if (error) {
        console.error('Error creating default tags:', error)
      } else {
        console.log('Successfully created default tags for form:', formId)
      }
    } catch (error) {
      console.error('Error in createDefaultTags:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    const trimmedName = productName.trim()
    if (!trimmedName) {
      setError('Please enter a product name')
      return
    }
    
    setIsSubmitting(true)
    const newFormId = nanoid(10)
    
    try {
      const { error: insertError } = await supabase
        .from('forms')
        .insert([{ 
          id: newFormId, 
          product_name: trimmedName,
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
        }])
        
      if (insertError) {
        console.error('Supabase insert error details:', insertError)
        throw insertError
      }
      
      await createDefaultTags(newFormId)
      
      // Add current user as admin collaborator
      if (user?.id && user?.email) {
        const { error: collaboratorError } = await supabase
          .from('form_collaborators')
          .insert({
            form_id: newFormId,
            user_id: user.id,
            role: 'admin',
            invited_by: user.id,
            invitation_email: user.email,
            invitation_accepted: true
          })
          
        if (collaboratorError) {
          console.error('Error adding user as admin collaborator:', collaboratorError)
        }
      }
      
      // Create sample feedback data for this new workspace
      try {
        await createSampleFeedback(newFormId)
      } catch (sampleError) {
        console.error('Error creating sample feedback:', sampleError)
        // Continue even if sample feedback creation fails
      }
      
      // Save form ID in localStorage for onboarding/quick access
      if (user?.id) {
        localStorage.setItem(`usermonk-last-form-${user.id}`, newFormId)
      }
      
      // Set a flag in localStorage to indicate intentional navigation
      localStorage.setItem('usermonk-navigating-to-new-form', newFormId)
      
      // Blur any active element
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
      
      // Reset dialog and close it
      resetDialog()
      onClose()
      
      toast.success('Workspace created successfully')
      
      // Navigate to the new form
      navigate(`/forms/${newFormId}`)
      
      // Clear the flag after navigation
      setTimeout(() => {
        localStorage.removeItem('usermonk-navigating-to-new-form')
      }, 1000)
      
      // Track event
      await trackEvent('form_create', user?.id || 'anonymous', {
        form_id: newFormId,
        product_name: trimmedName,
        source: 'creator_dialog'
      })
    } catch (error) {
      console.error('Error creating workspace:', error)
      setError('Failed to create workspace')
    } finally {
      setIsSubmitting(false)
    }
  }
  
  // Don't render anything if not open
  if (!open) return null
  
  return (
    <div
      ref={setDialogElement}
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="dialog-content bg-background rounded-lg shadow-lg w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-semibold">New Workspace</h2>
          <button
            onClick={handleClose}
            className="rounded-full p-1 hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        
        <div className="p-4">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="productName">Product Name</Label>
              <Input
                id="productName"
                value={productName}
                onChange={e => setProductName(e.target.value)}
                placeholder="e.g., Acme Inc."
                className={error ? 'border-destructive' : ''}
                aria-invalid={!!error}
              />
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <p className="text-xs text-muted-foreground">
                A friendly name for your product shown in the forms dropdown
              </p>
            </div>
            
            <Button 
              type="submit" 
              className="w-full"
              disabled={!productName.trim() || isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Workspace'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
} 