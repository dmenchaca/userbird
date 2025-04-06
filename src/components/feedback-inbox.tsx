import { useState, useEffect, useImperativeHandle, forwardRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Loader } from 'lucide-react'
import { FeedbackResponse, FeedbackTag } from '@/lib/types/feedback'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { Checkbox } from './ui/checkbox'

// Utility function to ensure high contrast for tag text
const getHighContrastColor = (hexColor: string): string => {
  // Remove the # if it exists
  const color = hexColor.startsWith('#') ? hexColor.slice(1) : hexColor;
  
  // Convert hex to RGB
  const r = parseInt(color.slice(0, 2), 16);
  const g = parseInt(color.slice(2, 4), 16);
  const b = parseInt(color.slice(4, 6), 16);
  
  // Calculate brightness and adjust for better contrast
  // We want a darker, more saturated version of the color for better contrast
  // against the light background (which is at 0.125 opacity)
  
  // Make the color darker for better contrast on light backgrounds
  const darkR = Math.max(0, Math.floor(r * 0.7));
  const darkG = Math.max(0, Math.floor(g * 0.7));
  const darkB = Math.max(0, Math.floor(b * 0.7));
  
  return `rgb(${darkR}, ${darkG}, ${darkB})`;
};

interface FeedbackInboxProps {
  formId: string
  statusFilter?: 'all' | 'open' | 'closed'
  tagFilter?: string
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
  tagFilter,
  onResponseSelect,
  onSelectionChange
}, ref) => {
  const [responses, setResponses] = useState<FeedbackResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  
  // Use the status filter coming from props
  const currentStatusFilter = externalStatusFilter;
  
  // Filter responses based on search query
  const filteredResponses = responses.filter(response => {
    if (!searchQuery.trim()) return true
    
    const query = searchQuery.toLowerCase()
    return (
      (response.message && response.message.toLowerCase().includes(query)) ||
      (response.user_name && response.user_name.toLowerCase().includes(query)) ||
      (response.user_email && response.user_email.toLowerCase().includes(query)) ||
      (response.operating_system && response.operating_system.toLowerCase().includes(query)) ||
      (response.screen_category && response.screen_category.toLowerCase().includes(query)) ||
      (response.tag && response.tag.name.toLowerCase().includes(query))
    )
  })

  // Function to fetch responses
  const fetchResponses = async () => {
    try {
      setLoading(true)
      
      // First, fetch tags specific to this form only
      const { data: tagsData, error: tagsError } = await supabase
        .from('feedback_tags')
        .select('*')
        .eq('form_id', formId)
      
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

      // Apply tag filter if specified
      if (tagFilter) {
        query = query.eq('tag_id', tagFilter)
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

  // Reset selection when responses change or filters change
  useEffect(() => {
    setSelectedIds([]);
    if (onSelectionChange) {
      onSelectionChange([]);
    }
  }, [formId, currentStatusFilter, tagFilter, onSelectionChange]);

  // Notify parent of selection changes
  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(selectedIds);
    }
  }, [selectedIds, onSelectionChange]);

  // Select or deselect all items
  const selectAll = (selected: boolean) => {
    if (selected) {
      setSelectedIds(filteredResponses.map(r => r.id));
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
  }, [formId, currentStatusFilter, tagFilter])

  // Reset search when filter changes
  useEffect(() => {
    setSearchQuery('')
  }, [formId, currentStatusFilter, tagFilter])

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

  // Helper to format the user name
  const formatName = (response: FeedbackResponse) => {
    if (response.user_name) return response.user_name
    if (response.user_email) return response.user_email.split('@')[0]
    return 'Anonymous'
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
      {/* Search bar */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>
        <input
          type="text"
          placeholder="Search messages..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-8 py-2 bg-background border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-input"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        )}
      </div>
      
      {filteredResponses.length === 0 && searchQuery.trim() !== '' ? (
        <div className="text-center py-8 text-muted-foreground">
          No matches found for "{searchQuery}"
        </div>
      ) : (
        <>
          {filteredResponses.length > 0 && (
            <div className="flex items-center mb-3">
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="select-all"
                  checked={selectedIds.length === filteredResponses.length && filteredResponses.length > 0}
                  indeterminate={selectedIds.length > 0 && selectedIds.length < filteredResponses.length}
                  onCheckedChange={selectAll}
                  aria-label={selectedIds.length === filteredResponses.length ? "Deselect all" : "Select all"}
                />
                <label htmlFor="select-all" className="text-xs text-muted-foreground cursor-pointer">
                  {selectedIds.length > 0 
                    ? `${selectedIds.length} of ${filteredResponses.length} selected` 
                    : "Select all"}
                </label>
              </div>
            </div>
          )}
          <div className="flex flex-col gap-4">
            {filteredResponses.map((response) => (
              <div
                key={response.id}
                className={cn(
                  "flex flex-col rounded-lg border p-3 text-left text-sm transition-all w-full",
                  selectedIds.includes(response.id) ? "bg-primary/5 border-primary/20" : "hover:bg-accent"
                )}
              >
                <div className="flex items-start gap-3 w-full">
                  <div className="flex-shrink-0 pt-0.5">
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
                    <div className="line-clamp-2 text-xs text-muted-foreground text-left">
                      {response.message}
                    </div>
                    <div className="flex items-center gap-2">
                      {response.tag ? (
                        <div 
                          className="overflow-hidden max-w-[190px] rounded-md py-[3px] px-[6px] pl-[3px] font-medium cursor-pointer transition-colors"
                          style={{ 
                            userSelect: "none"
                          }}
                        >
                          <div 
                            className="inline-flex items-center flex-shrink-1 min-w-0 max-w-full h-[20px] rounded-[3px] px-[6px] text-[12px] leading-[120%] font-semibold"
                            style={{ 
                              backgroundColor: `${response.tag.color}20`,
                              color: getHighContrastColor(response.tag.color)
                            }}
                          >
                            <div className="whitespace-nowrap overflow-hidden text-ellipsis inline-flex items-center h-[20px] leading-[20px]">
                              <span className="whitespace-nowrap overflow-hidden text-ellipsis">{response.tag.name}</span>
                            </div>
                          </div>
                        </div>
                      ) : null}
                      {response.status === 'closed' && (
                        <div className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                          Closed
                        </div>
                      )}
                    </div>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}) 