import { useState, useEffect, useImperativeHandle, forwardRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Loader } from 'lucide-react'
import { FeedbackResponse, FeedbackTag } from '@/lib/types/feedback'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { Checkbox } from './ui/checkbox'

interface FeedbackInboxProps {
  formId: string
  statusFilter?: 'all' | 'open' | 'closed'
  onResponseSelect?: (response: FeedbackResponse) => void
  onSelectionChange?: (selectedIds: string[]) => void
}

export interface FeedbackInboxRef {
  refreshData: () => Promise<void>;
  clearSelection: () => void;
}

export const FeedbackInbox = forwardRef<FeedbackInboxRef, FeedbackInboxProps>(({ 
  formId,
  statusFilter: externalStatusFilter = 'all',
  onResponseSelect,
  onSelectionChange
}, ref) => {
  const [responses, setResponses] = useState<FeedbackResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  
  // Use the status filter coming from props
  const currentStatusFilter = externalStatusFilter;

  // Function to fetch responses
  const fetchResponses = async () => {
    try {
      setLoading(true)
      
      // First, fetch all available tags
      const { data: tagsData, error: tagsError } = await supabase
        .from('feedback_tags')
        .select('*')
      
      if (tagsError) {
        console.error('Error fetching tags:', tagsError)
      }
      
      // Convert tags array to a lookup object
      const tagsLookup: Record<string, FeedbackTag> = {}
      if (tagsData) {
        tagsData.forEach(tag => {
          tagsLookup[tag.id] = tag
        })
      }
      
      // Then fetch feedback data
      let query = supabase
        .from('feedback')
        .select('*')
        .eq('form_id', formId)
        .order('created_at', { ascending: false })
      
      // Apply status filter if not showing all
      if (currentStatusFilter !== 'all') {
        query = query.eq('status', currentStatusFilter)
      }

      const { data, error } = await query

      if (error) throw error
      
      // Enhance the responses with their tag data
      const enhancedResponses = data?.map(item => {
        // Create a copy of the response
        const response = { ...item } as FeedbackResponse
        
        // If the response has a tag_id, add the corresponding tag object
        if (response.tag_id && tagsLookup[response.tag_id]) {
          response.tag = tagsLookup[response.tag_id]
        }
        
        return response
      }) || []
      
      setResponses(enhancedResponses)
    } catch (error) {
      console.error('Error fetching responses:', error)
    } finally {
      setLoading(false)
    }
  };

  // Expose the refresh method and selection clear to parent components
  useImperativeHandle(ref, () => ({
    refreshData: fetchResponses,
    clearSelection: () => setSelectedIds([])
  }));

  // Reset selection when responses change
  useEffect(() => {
    setSelectedIds([]);
    if (onSelectionChange) {
      onSelectionChange([]);
    }
  }, [formId, currentStatusFilter, onSelectionChange]);

  // Notify parent of selection changes
  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(selectedIds);
    }
  }, [selectedIds, onSelectionChange]);

  // Select or deselect all items
  const selectAll = (selected: boolean) => {
    if (selected) {
      setSelectedIds(responses.map(r => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  useEffect(() => {
    fetchResponses();

    // Subscribe to new responses
    const channel = supabase
      .channel('responses_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'feedback',
        filter: `form_id=eq.${formId}`
      }, async () => {
        // Refresh data when changes are detected
        fetchResponses();
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
      {responses.length > 0 && (
        <div className="flex items-center mb-3">
          <div className="flex items-center gap-2">
            <Checkbox 
              id="select-all"
              checked={selectedIds.length === responses.length && responses.length > 0}
              indeterminate={selectedIds.length > 0 && selectedIds.length < responses.length}
              onCheckedChange={selectAll}
              aria-label={selectedIds.length === responses.length ? "Deselect all" : "Select all"}
            />
            <label htmlFor="select-all" className="text-xs text-muted-foreground cursor-pointer">
              {selectedIds.length > 0 
                ? `${selectedIds.length} of ${responses.length} selected` 
                : "Select all"}
            </label>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-4">
        {responses.map((response) => (
          <div
            key={response.id}
            className={cn(
              "flex flex-col rounded-lg border p-3 text-left text-sm transition-all w-full",
              selectedIds.includes(response.id) ? "bg-primary/5 border-primary/20" : "hover:bg-accent"
            )}
          >
            <div className="flex items-start gap-3 w-full">
              <div className="flex-shrink-0 pt-1">
                <Checkbox 
                  checked={selectedIds.includes(response.id)}
                  onCheckedChange={(checked: boolean) => {
                    if (checked) {
                      setSelectedIds(prev => [...prev, response.id]);
                    } else {
                      setSelectedIds(prev => prev.filter(id => id !== response.id));
                    }
                  }}
                  onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                    e.stopPropagation(); // Just stop propagation, don't toggle selection
                  }}
                  aria-label={`Select ${formatName(response)}'s feedback`}
                />
              </div>
              <button
                className="flex flex-col items-start gap-2 w-full"
                onClick={() => {
                  if (onResponseSelect) {
                    onResponseSelect(response);
                  }
                }}
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
                </div>
                <div className="line-clamp-2 text-xs text-muted-foreground">
                  {response.message}
                </div>
                <div className="flex items-center gap-2">
                  {response.tag ? (
                    <div 
                      className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent"
                      style={{ 
                        backgroundColor: `${response.tag.color}20`, // Adding 20 for opacity
                        color: response.tag.color,
                        borderColor: `${response.tag.color}40` // Adding 40 for opacity
                      }}
                    >
                      {response.tag.name}
                    </div>
                  ) : (
                    <>
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
                    </>
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
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}) 