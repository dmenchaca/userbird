import { useState } from 'react'
import { nanoid } from 'nanoid'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { isValidUrl, isValidHexColor } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { FormInstructions } from './form-instructions'

export function FormCreator() {
  const [url, setUrl] = useState('')
  const [buttonColor, setButtonColor] = useState('#1f2937')
  const [formId, setFormId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!url) {
      setError('Please enter a URL')
      return
    }

    if (!isValidUrl(`https://${url}`)) {
      setError('Please enter a valid URL')
      return
    }

    if (!isValidHexColor(buttonColor)) {
      setError('Please enter a valid hex color (e.g., #1f2937)')
      return
    }

    const newFormId = nanoid(10)
    
    try {
      const { error: insertError } = await supabase
        .from('forms')
        .insert([{ 
          id: newFormId, 
          url,
          button_color: buttonColor 
        }])
      
      if (insertError) throw insertError
      
      setFormId(newFormId)
    } catch (error) {
      console.error('Error creating form:', error)
      setError('Failed to create form')
    }
  }

  if (formId) {
    return <FormInstructions formId={formId} />
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="url">Website URL</Label>
          <div className="flex gap-2">
            <span className="flex items-center text-sm text-muted-foreground">https://</span>
            <Input
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="app.userbird.co"
              className={error ? 'border-destructive' : ''}
            />
          </div>
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

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <Button type="submit" size="lg">Create Form</Button>
    </form>
  )
}