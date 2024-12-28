import { useState } from 'react'
import { nanoid } from 'nanoid'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { isValidUrl } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { FeedbackTable } from './feedback-table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'

export function FormCreator() {
  const [url, setUrl] = useState('')
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

    const newFormId = nanoid(10)
    
    try {
      const { error: insertError } = await supabase
        .from('forms')
        .insert([{ id: newFormId, url }])
      
      if (insertError) throw insertError
      
      setFormId(newFormId)
    } catch (error) {
      console.error('Error creating form:', error)
      setError('Failed to create form')
    }
  }

  if (formId) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Installation Instructions</h2>
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Choose your preferred integration method:
          </p>

          <Tabs defaultValue="html" className="w-full">
            <TabsList>
              <TabsTrigger value="html">HTML</TabsTrigger>
              <TabsTrigger value="react">React</TabsTrigger>
              <TabsTrigger value="script">Script Tag</TabsTrigger>
            </TabsList>

            <TabsContent value="html" className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">HTML Integration</h3>
                <p className="text-sm text-muted-foreground mb-4">Add this button anywhere in your HTML:</p>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
                  <code>{`<button id="userbird-trigger-${formId}">Feedback</button>`}</code>
                </pre>
              </div>
            </TabsContent>

            <TabsContent value="react" className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">React Integration</h3>
                <p className="text-sm text-muted-foreground mb-4">Initialize the widget in your React component:</p>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
                  <code>{`import { useEffect } from 'react';

function App() {
  useEffect(() => {
    // Initialize Userbird
    window.UserBird = window.UserBird || {};
    window.UserBird.formId = "${formId}";
    
    const script = document.createElement('script');
    script.src = 'https://userbird.netlify.app/widget.js';
    document.head.appendChild(script);
  }, []);

  return (
    <button id="userbird-trigger-${formId}">
      Feedback
    </button>
  );
}`}</code>
                </pre>
              </div>
            </TabsContent>

            <TabsContent value="script" className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Script Tag Integration</h3>
                <p className="text-sm text-muted-foreground mb-4">Add this code just before the closing <code>&lt;/body&gt;</code> tag:</p>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
                  <code>{`<script>
  (function(w,d,i,s){
    w.UserBird=w.UserBird||function(){};
    w.UserBird.formId="${formId}";
    w.UserBird.position="auto"; // Automatically positions the form based on available space
    s=d.createElement('script');
    s.src='https://userbird.netlify.app/widget.js';
    d.head.appendChild(s);
  })(window,document);
</script>`}</code>
                </pre>
              </div>
            </TabsContent>
          </Tabs>

          <div className="rounded-lg border p-4 bg-muted/50">
            <h4 className="text-sm font-medium mb-2">Note</h4>
            <p className="text-sm text-muted-foreground">
              The feedback form will automatically position itself relative to the trigger button,
              adjusting its placement based on available space in the viewport.
            </p>
          </div>

          <Button onClick={() => setFormId(null)}>Create Another Form</Button>

          <div className="pt-8">
            <h3 className="text-lg font-semibold mb-4">Feedback Submissions</h3>
            <FeedbackTable formId={formId} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <Button type="submit" size="lg">Create Form</Button>
    </form>
  )
}