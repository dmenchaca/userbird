import React, { useState, useEffect } from 'react'
import { nanoid } from 'nanoid'
import { Button } from './ui/button' 
import { Input } from './ui/input'
import { Label } from './ui/label'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth'
import { useNavigate } from 'react-router-dom'
import { trackEvent } from '@/lib/posthog'

interface FormCreatorProps {
  onFormCreated?: (formId: string) => void;
  onFormChange?: (hasChanges: boolean) => void;
}

export function FormCreator({ onFormCreated, onFormChange }: FormCreatorProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [productName, setProductName] = useState('')
  const [error, setError] = useState('')

  // Notify parent about form changes
  // Only productName is relevant now
  useEffect(() => {
    onFormChange?.(productName.trim() !== '')
  }, [productName, onFormChange])

  // Function to create default tags for a new form
  const createDefaultTags = async (formId: string) => {
    try {
      const defaultTags = [
        { name: '⚠️ Bug', color: '#EF4444', is_favorite: true },       // Red
        { name: '☠️ Data loss', color: '#7C3AED', is_favorite: true }, // Purple 
        { name: '🫤 Glitch', color: '#F59E0B', is_favorite: true },    // Amber
        { name: '🚀 New feature', color: '#10B981', is_favorite: true }, // Emerald
        { name: '❤️ Love it', color: '#EC4899', is_favorite: true }    // Pink
      ];
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const trimmedName = productName.trim()
    if (!trimmedName) {
      setError('Please enter a product name')
      return
    }
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
          keyboard_shortcut: 'L',
          gif_urls: [
            'https://media1.tenor.com/m/TqHquUQoqu8AAAAd/you%27re-a-lifesaver-dove.gif',
            'https://media1.tenor.com/m/4PLfYPBvjhQAAAAd/tannerparty-tanner.gif',
            'https://media1.tenor.com/m/lRY5I7kwR08AAAAd/brooklyn-nine-nine-amy-and-rosa.gif',
            'https://media1.tenor.com/m/9LbEpuHBPScAAAAd/brooklyn-nine-nine-amy-and-rosa.gif',
            'https://media1.tenor.com/m/mnx8ECSie6EAAAAd/sheldon-cooper-big-bang-theory.gif'
          ]
        }])
      if (insertError) {
        console.error('Supabase insert error details:', insertError);
        throw insertError;
      }
      await createDefaultTags(newFormId);
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
          });
        if (collaboratorError) {
          console.error('Error adding user as admin collaborator:', collaboratorError);
          // Optionally show a toast or set error
        }
      }
      // Save form ID in localStorage for onboarding/quick access
      const userId = user?.id;
      if (userId) {
        localStorage.setItem(`userbird-last-form-${userId}`, newFormId);
      }
      
      toast.success('Form created successfully')
      
      // First call onFormCreated callback to trigger navigation immediately
      if (onFormCreated) {
        console.log('Calling onFormCreated with form ID:', newFormId);
        onFormCreated(newFormId);
        console.log('onFormCreated callback completed');
      } else {
        console.log('No onFormCreated callback, navigating directly to:', `/forms/${newFormId}`);
        navigate(`/forms/${newFormId}`);
      }
      
      // Track event after navigation has been triggered
      await trackEvent('form_create', user?.id || 'anonymous', {
        form_id: newFormId,
        product_name: trimmedName
      });
    } catch (error) {
      console.error('Error creating form:', error)
      setError('Failed to create form')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="productName">Product Name</Label>
          <Input
            autoFocus
            id="productName"
            value={productName}
            onChange={e => setProductName(e.target.value)}
            placeholder="e.g., Acme Inc."
            className={error ? 'border-destructive' : ''}
            aria-invalid={!!error}
          />
          {error && (
            <p className="text-sm text-destructive mt-2">{error}</p>
          )}
          <p className="text-xs text-muted-foreground">
            A friendly name for your product shown in the forms dropdown
          </p>
        </div>
      </div>
      <Button type="submit" size="lg" disabled={!productName.trim()}>Create Form</Button>
    </form>
  )
}