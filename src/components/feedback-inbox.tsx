import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Loader } from 'lucide-react'
import { ResponseDetails } from './response-details'
import { FeedbackResponse } from '@/lib/types/feedback'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'

interface FeedbackInboxProps {
  formId: string
  statusFilter?: 'all' | 'open' | 'closed'
  onFilterChange?: (filter: 'all' | 'open' | 'closed') => void
}

export function FeedbackInbox({ 
  formId,
  statusFilter: externalStatusFilter = 'all',
  onFilterChange
}: FeedbackInboxProps) {
  const [responses, setResponses] = useState<FeedbackResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedResponse, setSelectedResponse] = useState<FeedbackResponse | null>(null)
  
  // Use the status filter coming from props
  const currentStatusFilter = externalStatusFilter;

  const handleStatusChange = (id: string, status: 'open' | 'closed') => {
    // Update the status in our local state
    setResponses(current => 
      current.map(response => 
        response.id === id 
          ? { ...response, status } 
          : response
      )
    )
    
    // Also update the selected response if it's the one that changed
    if (selectedResponse && selectedResponse.id === id) {
      setSelectedResponse({
        ...selectedResponse,
        status
      })
    }
  }

  useEffect(() => {
    async function fetchResponses() {
      try {
        let query = supabase
          .from('feedback')
          .select('*')
          .eq('form_id', formId)
          .order('created_at', { ascending: false })
        
        // Apply status filter if not showing all
        if (currentStatusFilter !== 'all') {
          query = query.eq('status', currentStatusFilter)
        }

        const { data: responses, error } = await query

        if (error) throw error
        setResponses(responses || [])
      } catch (error) {
        console.error('Error fetching responses:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchResponses()

    // Subscribe to new responses
    const channel = supabase
      .channel('responses_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'feedback',
        filter: `form_id=eq.${formId}`
      }, async () => {
        // Refetch all responses to ensure consistency
        let query = supabase
          .from('feedback')
          .select('*')
          .eq('form_id', formId)
          .order('created_at', { ascending: false })
        
        // Apply status filter if not showing all
        if (currentStatusFilter !== 'all') {
          query = query.eq('status', currentStatusFilter)
        }
        
        const { data } = await query

        if (data) {
          setResponses(data)
        }
      })
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [formId, currentStatusFilter])

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (responses.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No responses yet
      </div>
    )
  }

  // Helper function to extract tags from a message
  const extractTags = (message: string) => {
    const tagRegex = /#(\w+)/g
    const matches = [...message.matchAll(tagRegex)]
    return matches.map(match => match[1])
  }

  // Helper to format the user name
  const formatName = (response: FeedbackResponse) => {
    if (response.user_name) return response.user_name
    if (response.user_email) return response.user_email.split('@')[0]
    return 'Anonymous User'
  }

  // Helper to format time ago
  const formatTimeAgo = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true })
    } catch (error) {
      return 'some time ago'
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {responses.map((response) => (
          <button
            key={response.id}
            className="flex flex-col items-start gap-2 rounded-lg border p-3 text-left text-sm transition-all hover:bg-accent"
            onClick={() => setSelectedResponse(response)}
          >
            <div className="flex w-full flex-col gap-1">
              <div className="flex items-center">
                <div className="flex items-center gap-2">
                  <div className="font-semibold">{formatName(response)}</div>
                </div>
                <div className="ml-auto text-xs text-muted-foreground">
                  {formatTimeAgo(response.created_at)}
                </div>
              </div>
              <div className="text-xs font-medium">
                {response.url_path ? response.url_path.split('/').filter(Boolean).pop() || 'Feedback' : 'Feedback'}
              </div>
            </div>
            <div className="line-clamp-2 text-xs text-muted-foreground">
              {response.message}
            </div>
            <div className="flex items-center gap-2">
              {response.operating_system && (
                <div className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                  {response.operating_system}
                </div>
              )}
              {response.screen_category && (
                <div className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                  {response.screen_category}
                </div>
              )}
              {response.status && (
                <div className={cn(
                  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent",
                  response.status === 'open' 
                    ? "bg-primary text-primary-foreground shadow hover:bg-primary/80" 
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}>
                  {response.status}
                </div>
              )}
              {/* Extract hashtags from message as tags */}
              {extractTags(response.message).map((tag, index) => (
                <div 
                  key={index}
                  className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80"
                >
                  {tag}
                </div>
              ))}
            </div>
          </button>
        ))}
      </div>
      
      {/* Response details dialog */}
      {selectedResponse && (
        <ResponseDetails 
          response={selectedResponse} 
          onClose={() => setSelectedResponse(null)}
          onDelete={(id) => {
            // Handle delete - could be enhanced with confirmation dialog
            setResponses(current => current.filter(r => r.id !== id))
            setSelectedResponse(null)
          }}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  )
} 