import { useState, useEffect } from 'react'
import { nanoid } from 'nanoid'
import { Button } from './ui/button' 
import { Input } from './ui/input'
import { Label } from './ui/label'
import { isValidHexColor } from '@/lib/utils'
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
  const [url, setUrl] = useState('')
  const [buttonColor, setButtonColor] = useState('#1f2937')
  const [supportText, setSupportText] = useState('')
  const [error, setError] = useState('')
  const [isValidDomain, setIsValidDomain] = useState(false)

  // Clean up URL as user types
  const handleUrlChange = (value: string) => {
    const cleanUrl = value
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '');
    
    setUrl(cleanUrl);
  };

  // Validate URL as user types
  useEffect(() => {
    const trimmedUrl = url.trim()
    if (!trimmedUrl) {
      setIsValidDomain(false)
      return
    }

    const cleanUrl = trimmedUrl
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .toLowerCase()

    // Basic URL format validation
    const isValid = (
      cleanUrl === 'localhost' ||
      (/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/.test(cleanUrl) &&
      cleanUrl.includes('.') &&
      !['example.com', 'test.com', 'domain.com'].includes(cleanUrl))
    )

    setIsValidDomain(isValid)
  }, [url])

  // Notify parent about form changes
  useEffect(() => {
    onFormChange?.(url !== '' || buttonColor !== '#1f2937' || supportText !== '')
  }, [url, buttonColor, supportText, onFormChange])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const trimmedUrl = url.trim()
    
    if (!trimmedUrl) {
      setError('Please enter a website URL')
      return
    }

    // Remove any protocol and www prefix for storage
    const cleanUrl = trimmedUrl
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .toLowerCase()

    // Basic URL format validation
    if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/.test(cleanUrl)) {
      setError('Please enter a valid domain name (e.g., example.com)')
      return
    }

    // Check for at least one dot in the domain (except for localhost)
    if (cleanUrl !== 'localhost' && !cleanUrl.includes('.')) {
      setError('Please enter a valid domain name with TLD (e.g., example.com)')
      return
    }

    // Prevent common invalid domains
    if (['example.com', 'test.com', 'domain.com'].includes(cleanUrl)) {
      setError('Please enter your actual website domain')
      return
    }

    if (!isValidHexColor(buttonColor)) {
      setError('Please enter a valid hex color (e.g., #1f2937)')
      return
    }

    const newFormId = nanoid(10)
    
    try {
      console.log('Inserting form with gif settings:', {
        show_gif_on_success: true,
        remove_branding: false,
        keyboard_shortcut: 'L',
        gif_urls: ['https://media1.tenor.com/m/TqHquUQoqu8AAAAd/you%27re-a-lifesaver-dove.gif', '...and more']
      });
      
      const { error: insertError } = await supabase
        .from('forms')
        .insert([{ 
          id: newFormId, 
          url: cleanUrl,
          owner_id: user?.id,
          button_color: buttonColor,
          support_text: supportText || null,
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
      
      // After successful insert, verify what was actually saved
      console.log('Form created with ID:', newFormId);
      const { data: verifyData } = await supabase
        .from('forms')
        .select('show_gif_on_success, remove_branding, keyboard_shortcut, gif_urls')
        .eq('id', newFormId)
        .single();
      
      console.log('Verified form data in database:', verifyData);
      
      toast.success('Form created successfully')
      
      // Track form creation event
      await trackEvent('form_create', user?.id || 'anonymous', {
        form_id: newFormId,
        url: cleanUrl,
        has_support_text: !!supportText,
        has_custom_color: buttonColor !== '#1f2937'
      })
      
      if (onFormCreated) {
        onFormCreated(newFormId)
      } else {
        // If no callback provided, navigate directly
        navigate(`/forms/${newFormId}`)
      }
    } catch (error) {
      console.error('Error creating form:', error)
      setError('Failed to create form')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="url">Website URL</Label>
          <div className="flex gap-2">
            <span className="flex items-center text-sm text-muted-foreground">https://</span>
            <Input
              autoFocus
              id="url"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="app.userbird.co"
              className={error ? 'border-destructive' : ''}
              aria-invalid={!!error}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive mt-2">{error}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="buttonColor">Button Color</Label>
          <div className="flex gap-2">
            <Input
              id="buttonColor"
              type="color"
              value={buttonColor}
              onChange={(e) => setButtonColor(e.target.value)}
              className="w-20"
            />
            <Input
              value={buttonColor}
              onChange={(e) => setButtonColor(e.target.value)}
              placeholder="#1f2937"
              pattern="^#[0-9a-fA-F]{6}$"
              className="font-mono"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Choose a color for the feedback button
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="supportText">Support Text (optional)</Label>
          <Input
            id="supportText"
            value={supportText}
            onChange={(e) => setSupportText(e.target.value)}
            placeholder="Have a specific issue? [Contact support](https://example.com) or [read our docs](https://docs.example.com)"
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Add optional support text with markdown links. Example: [Link text](https://example.com)
          </p>
        </div>

      </div>
      <Button type="submit" size="lg" disabled={!isValidDomain}>Create Form</Button>
    </form>
  )
}