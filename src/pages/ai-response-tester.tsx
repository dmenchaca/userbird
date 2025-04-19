import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
// @ts-ignore - Next.js types not available
import Head from 'next/head'

export default function AiResponseTester() {
  const { user } = useAuth()
  const [feedbackId, setFeedbackId] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [response, setResponse] = useState('')
  const [error, setError] = useState('')
  const [feedbackDetails, setFeedbackDetails] = useState<any>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const responseContainerRef = useRef<HTMLDivElement>(null)

  // Load the default system prompt on mount
  useEffect(() => {
    // Set the default system prompt from generate-reply.ts
    setSystemPrompt(`You are a helpful, empathetic product support assistant replying to a customer's feedback message. 
Always acknowledge the user's concerns with care. Use the conversation history and the company's 
help documentation to generate a professional, accurate, and actionable reply.
Keep responses concise, free of filler, and to the point. Only reference relevant information 
from the docs. If unsure, it's okay to say so.

VERY IMPORTANT: Your replies must always follow this exact format WITH THE EXACT LINE BREAKS:

Hi {first name},
{Rest of the reply}

Best,
{Agent's first name}

NOTE: Use only SINGLE line breaks between the greeting, body, and sign-off.
Do not add extra blank lines - a single line break is all that's needed.

To get the customer's first name, look at the feedback.user_name field and use the first word of the name. 
For example, if feedback.user_name is "Diego Menchaca", use "Diego" as the first name.
If user_name is not available, fall back to the first part of their email address before the @ symbol.

If the user's issue is not clear enough to provide a specific solution, politely ask them to share a Loom video recording of the issue to help you understand the problem better.`)
  }, [])

  // Fetch feedback details for preview
  const fetchFeedbackDetails = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('feedback')
        .select('*, form:form_id(*)')
        .eq('id', id)
        .single()

      if (error) throw error
      setFeedbackDetails(data)
      return data
    } catch (error) {
      console.error('Error fetching feedback:', error)
      setError('Failed to fetch feedback details')
      setFeedbackDetails(null)
      return null
    }
  }

  // Generate AI response
  const generateResponse = async () => {
    if (!feedbackId.trim()) {
      setError('Please enter a feedback ID')
      return
    }

    setIsGenerating(true)
    setResponse('')
    setError('')

    try {
      // First fetch the feedback details for display
      const feedbackData = await fetchFeedbackDetails(feedbackId)
      if (!feedbackData) {
        setError('Invalid feedback ID or feedback not found')
        setIsGenerating(false)
        return
      }

      // Create abort controller for cancellation
      const controller = new AbortController()
      abortControllerRef.current = controller

      // Call the custom endpoint that will accept the system prompt
      const streamResponse = await fetch('/api/test-ai-response', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          feedback_id: feedbackId,
          system_prompt: systemPrompt
        }),
        signal: controller.signal
      })

      if (!streamResponse.ok) {
        throw new Error(`Failed to generate reply: ${streamResponse.statusText}`)
      }

      if (!streamResponse.body) {
        throw new Error('No response body from AI generation')
      }

      // Process the streaming response
      const reader = streamResponse.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let accumulatedContent = ''

      console.log("=== TESTER: Stream connection established ===")

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          console.log("=== TESTER: Stream complete ===")
          break
        }

        // Decode the chunk and process it
        const chunk = decoder.decode(value, { stream: true })
        
        const lines = chunk.split('\n\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6) // Remove "data: " prefix

            // Check for done event
            if (data === '[DONE]') {
              console.log("=== TESTER: Received [DONE] marker ===")
              continue
            }

            // Restore line breaks from special markers
            let processedData = data
            if (data.includes("[[NEWLINE]]")) {
              processedData = data.replace(/\[\[NEWLINE\]\]/g, "\n")
            }

            // Append this content to the response
            accumulatedContent += processedData
            setResponse(accumulatedContent)

            // Auto-scroll to bottom of response container
            if (responseContainerRef.current) {
              responseContainerRef.current.scrollTop = responseContainerRef.current.scrollHeight
            }
          } else if (line.startsWith('event: error')) {
            throw new Error('Error generating AI reply')
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Error generating response:', error)
        setError(error.message || 'Failed to generate response')
      }
    } finally {
      setIsGenerating(false)
      abortControllerRef.current = null
    }
  }

  // Cancel generation
  const cancelGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setIsGenerating(false)
    }
  }

  // Format line breaks for display
  const formatWithLineBreaks = (text: string) => {
    return text.split('\n').map((line, i) => (
      <span key={i}>
        {line}
        <br />
      </span>
    ))
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Please sign in to access this tool</p>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>AI Response Tester</title>
      </Head>
      
      <div className="container mx-auto py-8 max-w-5xl">
        <h1 className="text-2xl font-bold mb-6">AI Response Tester</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Input Panel */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Feedback ID</CardTitle>
                <CardDescription>Enter the ID of the feedback to generate a response for</CardDescription>
              </CardHeader>
              <CardContent>
                <Label htmlFor="feedback-id">Feedback ID</Label>
                <Input 
                  id="feedback-id"
                  value={feedbackId} 
                  onChange={(e) => setFeedbackId(e.target.value)}
                  placeholder="00000000-0000-0000-0000-000000000000" 
                />
                <Button 
                  className="mt-4 w-full"
                  onClick={() => fetchFeedbackDetails(feedbackId)}
                  disabled={!feedbackId.trim() || isGenerating}
                >
                  Preview Feedback
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Prompt</CardTitle>
                <CardDescription>Customize the system prompt used for generation</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea 
                  value={systemPrompt} 
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  className="min-h-[300px] font-mono text-sm"
                  placeholder="Enter system prompt here" 
                />
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button 
                  variant="outline"
                  onClick={() => setSystemPrompt('')}
                  disabled={isGenerating}
                >
                  Clear
                </Button>
                <Button 
                  onClick={generateResponse}
                  disabled={!feedbackId.trim() || !systemPrompt.trim() || isGenerating}
                  className="ml-2"
                >
                  {isGenerating ? 'Generating...' : 'Generate Response'}
                </Button>
                {isGenerating && (
                  <Button 
                    variant="destructive"
                    onClick={cancelGeneration}
                  >
                    Cancel
                  </Button>
                )}
              </CardFooter>
            </Card>
          </div>

          {/* Output Panel */}
          <div className="space-y-6">
            {feedbackDetails && (
              <Card>
                <CardHeader>
                  <CardTitle>Feedback Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium">From:</p>
                    <p>{feedbackDetails.user_name || 'Anonymous'} {feedbackDetails.user_email ? `<${feedbackDetails.user_email}>` : ''}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Message:</p>
                    <div className="p-3 border rounded-md bg-muted/20">
                      {feedbackDetails.message}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Form:</p>
                    <p>{feedbackDetails.form?.product_name || feedbackDetails.form_id || 'N/A'}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Generated Response</CardTitle>
                <CardDescription>AI-generated reply based on your inputs</CardDescription>
              </CardHeader>
              <CardContent>
                {error && (
                  <div className="mb-4 p-3 border border-destructive rounded-md text-destructive">
                    {error}
                  </div>
                )}
                <div 
                  ref={responseContainerRef}
                  className={`p-4 border rounded-md min-h-[300px] max-h-[500px] overflow-y-auto ${isGenerating ? 'border-primary' : ''}`}
                >
                  {response ? (
                    <pre className="whitespace-pre-wrap font-sans text-sm">
                      {formatWithLineBreaks(response)}
                    </pre>
                  ) : (
                    <p className="text-muted-foreground">
                      {isGenerating ? 'Generating response...' : 'Response will appear here'}
                    </p>
                  )}
                </div>
              </CardContent>
              <CardFooter className="justify-end">
                {response && (
                  <Button 
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(response);
                    }}
                  >
                    Copy to Clipboard
                  </Button>
                )}
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
} 