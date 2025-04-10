import { useState, useEffect, useImperativeHandle, forwardRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Loader } from 'lucide-react'
import { FeedbackResponse, FeedbackTag } from '@/lib/types/feedback'
import { format, isToday } from 'date-fns'
import { cn } from '@/lib/utils'
import { Checkbox } from './ui/checkbox'

// Get tag colors from the color options
const getTagColors = (tagColor: string) => {
  // Import color options from the dashboard
  const colorOptions = [
    { 
      name: 'Gray', 
      value: '#64748B',
      background: '#64748B25',
      text: '#334155'
    },
    { 
      name: 'Brown', 
      value: '#78716C',
      background: '#78716C25',
      text: '#44403C'
    },
    { 
      name: 'Orange', 
      value: '#F97316',
      background: '#F9731625',
      text: '#C2410C'
    },
    { 
      name: 'Yellow', 
      value: '#EAB308',
      background: '#EAB30825',
      text: '#854D0E'
    },
    { 
      name: 'Green', 
      value: '#10B981',
      background: '#10B98125',
      text: '#047857'
    },
    { 
      name: 'Blue', 
      value: '#3B82F6',
      background: '#3B82F625',
      text: '#1D4ED8'
    },
    { 
      name: 'Purple', 
      value: '#8B5CF6',
      background: '#8B5CF625',
      text: '#6D28D9'
    },
    { 
      name: 'Pink', 
      value: '#EC4899',
      background: '#EC489925',
      text: '#BE185D'
    },
    { 
      name: 'Red', 
      value: '#EF4444',
      background: '#EF444425',
      text: '#B91C1C'
    }
  ];

  const colorOption = colorOptions.find(option => option.value === tagColor);
  return colorOption ? {
    background: colorOption.background,
    text: colorOption.text
  } : {
    background: `${tagColor}25`,
    text: tagColor
  };
};

interface FeedbackInboxProps {
  formId: string
  statusFilter?: 'all' | 'open' | 'closed'
  tagFilter?: string
  onResponseSelect?: (response: FeedbackResponse) => void
  onSelectionChange?: (selectedIds: string[]) => void
}

export interface FeedbackInboxRef {
  refreshData: (skipLoadingState?: boolean) => Promise<void>;
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
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)
  
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
  const fetchResponses = async (skipLoadingState = false) => {
    try {
      if (!skipLoadingState) {
        setLoading(true)
      }
      
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
      if (!skipLoadingState) {
        setLoading(false)
      }
    }
  };

  // Expose the refresh method and selection clear to parent components
  useImperativeHandle(ref, () => ({
    refreshData: (skipLoadingState = false) => fetchResponses(skipLoadingState),
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
        event: 'INSERT',
        schema: 'public',
        table: 'feedback',
        filter: `form_id=eq.${formId}`
      }, async (payload) => {
        // For new records, fetch the specific record and add it to the array
        try {
          const newResponse = payload.new as FeedbackResponse;
          
          // Fetch the tag if this response has a tag_id
          if (newResponse.tag_id) {
            const { data: tagData } = await supabase
              .from('feedback_tags')
              .select('*')
              .eq('id', newResponse.tag_id)
              .single();
              
            if (tagData) {
              newResponse.tag = tagData;
            }
          }
          
          // Add the new response to the top of the list
          setResponses(prev => [newResponse, ...prev]);
        } catch (error) {
          console.error('Error processing new feedback:', error);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'feedback',
        filter: `form_id=eq.${formId}`
      }, async (payload) => {
        // For updates, update the specific record in the array
        try {
          const updatedResponse = payload.new as FeedbackResponse;
          
          // Fetch the tag if this response has a tag_id
          if (updatedResponse.tag_id) {
            const { data: tagData } = await supabase
              .from('feedback_tags')
              .select('*')
              .eq('id', updatedResponse.tag_id)
              .single();
              
            if (tagData) {
              updatedResponse.tag = tagData;
            }
          }
          
          // Update the response in the array
          setResponses(prev => 
            prev.map(response => 
              response.id === updatedResponse.id ? updatedResponse : response
            )
          );
        } catch (error) {
          console.error('Error processing updated feedback:', error);
        }
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'feedback',
        filter: `form_id=eq.${formId}`
      }, (payload) => {
        // For deletions, remove the record from the array
        const deletedId = payload.old.id;
        setResponses(prev => prev.filter(response => response.id !== deletedId));
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

  // Handle checkbox change with modifier keys
  const handleCheckboxChange = (responseId: string, index: number, event: React.MouseEvent) => {
    event.stopPropagation();
    
    const isSelected = selectedIds.includes(responseId);
    const newCheckedState = !isSelected;
    
    if (event.shiftKey && lastSelectedIndex !== null) {
      // Shift-click: Select range
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const rangeIds = filteredResponses.slice(start, end + 1).map(r => r.id);
      
      setSelectedIds(prev => {
        if (newCheckedState) {
          // Add range to selection, preserving existing selections
          return [...new Set([...prev, ...rangeIds])];
        } else {
          // Remove range from selection
          return prev.filter(id => !rangeIds.includes(id));
        }
      });
    } else if (event.ctrlKey || event.metaKey) {
      // Control/Command-click: Toggle individual selection
      setSelectedIds(prev => 
        newCheckedState
          ? [...prev, responseId]
          : prev.filter(id => id !== responseId)
      );
    } else {
      // Normal click: Replace selection
      setSelectedIds(newCheckedState ? [responseId] : []);
    }
    
    // Update last selected index
    setLastSelectedIndex(index);
  };

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

  // Helper to strip HTML and convert to single line with proper spacing
  const stripHtmlAndFormat = (html: string) => {
    // Create a temporary div to handle HTML content
    const temp = document.createElement('div');
    temp.innerHTML = html;
    // Get text content (strips HTML) and replace multiple whitespace/newlines with single space
    return temp.textContent?.replace(/\s+/g, ' ').trim() || '';
  };

  // Helper to format time ago
  const formatTimeAgo = (dateString: string) => {
    try {
      const date = new Date(dateString);
      
      if (isToday(date)) {
        return format(date, 'h:mm a') // Format as "2:04 PM"
      } else {
        return format(date, 'MMM d') // Format as "Mar 5"
      }
    } catch (error) {
      return 'unknown date'
    }
  }

  return (
    <div className="space-y-4">
      {/* CSS to handle email content formatting */}
      <style dangerouslySetInnerHTML={{ 
        __html: `
          .email-content br + br {
            display: none;
          }
          .email-content div:empty {
            display: none;
          }
          .email-content p:empty {
            display: none;
          }
          .email-content div + br, .email-content br + div:empty {
            display: none;
          }
          .email-content {
            margin-bottom: 0;
          }
          .email-content > *:last-child {
            margin-bottom: 0;
          }
          .email-content div {
            min-height: 0;
          }
          /* Styling for email quotes */
          .gmail_quote_container {
            margin-top: 8px;
          }
          .gmail_attr {
            color: #666;
            margin-bottom: 8px;
            font-size: 0.9em;
          }
          .gmail_quote {
            margin: 0 0 0 0.8ex !important;
            border-left: 1px solid #ccc !important;
            padding-left: 1ex !important;
            color: #666;
          }
          /* Keep support for our custom classes too */
          .email_quote_container {
            margin-top: 8px;
          }
          .email_attr {
            color: #666;
            margin-bottom: 8px;
            font-size: 0.9em;
          }
          .email_quote {
            margin: 0 0 0 0.8ex !important;
            border-left: 1px solid #ccc !important;
            padding-left: 1ex !important;
            color: #666;
          }
        `
      }} />

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
            {filteredResponses.map((response, index) => (
              <button
                key={response.id}
                className={cn(
                  "flex flex-col rounded-lg border p-3 text-left text-sm transition-all w-full",
                  selectedIds.includes(response.id) ? "bg-primary/5 border-primary/20" : "hover:bg-accent"
                )}
                onClick={() => {
                  if (onResponseSelect) {
                    onResponseSelect(response);
                  }
                }}
              >
                <div className="flex items-start gap-3 w-full">
                  <div className="flex-shrink-0 pt-0.5">
                    <Checkbox 
                      checked={selectedIds.includes(response.id)}
                      onCheckedChange={() => {}}
                      onClick={(e) => handleCheckboxChange(response.id, index, e)}
                      aria-label={`Select ${formatName(response)}'s feedback`}
                    />
                  </div>
                  <div className="flex flex-col items-start gap-2 w-full">
                    <div className="flex w-full flex-col gap-1">
                      <div className="flex items-center">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold">{formatName(response)}</div>
                        </div>
                        <div className="ml-auto text-xs text-muted-foreground flex items-center gap-2">
                          <span className="inline-flex items-center text-xs text-muted-foreground border border-border rounded px-1.5">
                            #{response.ticket_number || '-'}
                          </span>
                          {formatTimeAgo(response.created_at)}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground text-left">
                      <div className="line-clamp-2 break-words">
                        {stripHtmlAndFormat(response.message)}
                      </div>
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
                            className="inline-flex items-center flex-shrink-1 min-w-0 max-w-full h-[20px] rounded-full px-2 text-[12px] leading-[120%] font-medium"
                            style={{ 
                              backgroundColor: getTagColors(response.tag.color).background,
                              color: getTagColors(response.tag.color).text
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
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}) 