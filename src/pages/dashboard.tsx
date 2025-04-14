import { useState, useCallback, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Plus, Code2, Settings2, Loader, Inbox, CheckCircle, Circle, Check, ChevronDown, Star, Tag, MoreHorizontal, UserCircle, ChevronsUpDown, Search, ArrowUp, ArrowDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { InstallInstructionsModal } from '@/components/install-instructions-modal'
import { FormSettingsDialog } from '@/components/form-settings-dialog'
import { NewFormDialog } from '@/components/new-form-dialog'
import { useAuth } from '@/lib/auth'
import { UserMenu } from '@/components/user-menu'
import { useNavigate } from 'react-router-dom'
import { FormsDropdown } from '@/components/forms-dropdown'
import { cn } from '@/lib/utils'
import { FeedbackInbox, FeedbackInboxRef } from '@/components/feedback-inbox'
import { FeedbackResponse, FeedbackTag } from '@/lib/types/feedback'
import { ConversationThread, ConversationThreadRef } from '@/components/conversation-thread'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { BatchActionBar } from '@/components/batch-action-bar'
import { TagManager } from '@/components/tag-manager'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { FeedbackImage } from '../../app/components/FeedbackImage'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { assignFeedback } from '@/lib/services/feedback-assignments'

interface DashboardProps {
  initialFormId?: string
  initialTicketNumber?: string
}

export function Dashboard({ initialFormId, initialTicketNumber }: DashboardProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [selectedFormId, setSelectedFormId] = useState<string | undefined>(initialFormId)
  const [formName, setFormName] = useState<string>('')
  const [productName, setProductName] = useState<string | null>(null)
  const [buttonColor, setButtonColor] = useState('#1f2937')
  const [supportText, setSupportText] = useState<string | null>(null)
  const [keyboardShortcut, setKeyboardShortcut] = useState<string | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [showGifOnSuccess, setShowGifOnSuccess] = useState(false)
  const [removeBranding, setRemoveBranding] = useState(false)
  const [gifUrls, setGifUrls] = useState<string[]>([])
  const [hasResponses, setHasResponses] = useState(false)
  const [showInstallModal, setShowInstallModal] = useState(false)
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [showNewFormDialog, setShowNewFormDialog] = useState(false)
  const [loading, setLoading] = useState(true) // Always start with loading true
  const [formsChecked, setFormsChecked] = useState(false) // Track whether we've checked for forms
  const [shouldShowInstructions, setShouldShowInstructions] = useState<boolean>(false)
  const showFeedbackHint = !selectedFormId
  const [feedbackCounts, setFeedbackCounts] = useState({ open: 0, closed: 0 })
  const [activeFilter, setActiveFilter] = useState<'all' | 'open' | 'closed' | { type: 'tag', id: string, name: string }>('open')
  const [selectedResponse, setSelectedResponse] = useState<FeedbackResponse | null>(null)
  const [initialResponseId, setInitialResponseId] = useState<string | null>(null)
  const [showImagePreview, setShowImagePreview] = useState(false)
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([])
  const inboxRef = useRef<FeedbackInboxRef>(null)
  const conversationThreadRef = useRef<ConversationThreadRef>(null)
  const [availableTags, setAvailableTags] = useState<FeedbackTag[]>([])
  const tagDropdownTriggerRef = useRef<HTMLButtonElement>(null)
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false)
  const [showAddTagPopover, setShowAddTagPopover] = useState(false)
  const [quickTagName, setQuickTagName] = useState('')
  const [quickTagColor, setQuickTagColor] = useState('#3B82F6')
  const [isQuickTagFavorite, setIsQuickTagFavorite] = useState(false)
  const statusDropdownTriggerRef = useRef<HTMLButtonElement>(null)
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false)
  const [showTagManagerDialog, setShowTagManagerDialog] = useState(false)
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
  const [feedbackToDelete, setFeedbackToDelete] = useState<string | null>(null)
  const [editingTag, setEditingTag] = useState<FeedbackTag | null>(null)
  const [editTagName, setEditTagName] = useState('')
  const [editTagColor, setEditTagColor] = useState('#3B82F6')
  const [editTagIsFavorite, setEditTagIsFavorite] = useState(false)
  
  // Team member assignment states
  const [collaborators, setCollaborators] = useState<{
    id: string
    user_id: string
    user_profile?: {
      email: string
      username: string
      avatar_url: string | null
    }
    invitation_email: string
    role: 'admin' | 'agent'
    invitation_accepted: boolean
  }[]>([])
  const assigneeDropdownTriggerRef = useRef<HTMLButtonElement>(null)
  const [isAssigneeDropdownOpen, setIsAssigneeDropdownOpen] = useState(false)
  const assigneeSearchInputRef = useRef<HTMLInputElement>(null)
  const [assigneeSearchTerm, setAssigneeSearchTerm] = useState('')
  const [focusedAssigneeIndex, setFocusedAssigneeIndex] = useState(-1)
  
  // Function to navigate to the next/previous response
  const navigateToResponse = (direction: 'next' | 'prev') => {
    if (!selectedResponse || !inboxRef.current) return;
    
    // Request the current responses from the inbox ref - these are already filtered
    // to match exactly what's visible in the UI
    if (inboxRef.current.getResponses) {
      const visibleResponses = inboxRef.current.getResponses();
      if (!visibleResponses.length) return;
      
      // Find the index of the current response in the visible responses list
      const currentIndex = visibleResponses.findIndex((response: FeedbackResponse) => response.id === selectedResponse.id);
      if (currentIndex === -1) return;
      
      // Calculate the new index without looping
      let newIndex;
      if (direction === 'next') {
        // Stop if we're at the bottom
        if (currentIndex + 1 >= visibleResponses.length) return;
        newIndex = currentIndex + 1;
      } else {
        // Stop if we're at the top
        if (currentIndex <= 0) return;
        newIndex = currentIndex - 1;
      }
      
      // Navigate to the new response
      if (visibleResponses[newIndex]) {
        // Set the active response in the inbox first to update the UI
        inboxRef.current.setActiveResponse(visibleResponses[newIndex].id);
        // Then update the selected response in the dashboard
        handleResponseSelect(visibleResponses[newIndex]);
      }
    }
  };
  
  // Color palette with explicit background and text colors for each tag
  const colorOptions = [
    { 
      name: 'Gray', 
      value: '#64748B',      // Slate
      background: '#64748B25',
      text: '#334155'        // Darker slate for contrast
    },
    { 
      name: 'Brown', 
      value: '#78716C',      // Stone
      background: '#78716C25',
      text: '#44403C'        // Darker stone for contrast
    },
    { 
      name: 'Orange', 
      value: '#F97316',      // Orange
      background: '#F9731625',
      text: '#C2410C'        // Darker orange for contrast
    },
    { 
      name: 'Yellow', 
      value: '#EAB308',      // Yellow
      background: '#EAB30825',
      text: '#854D0E'        // Darker yellow for contrast
    },
    { 
      name: 'Green', 
      value: '#10B981',      // Emerald
      background: '#10B98125',
      text: '#047857'        // Darker emerald for contrast
    },
    { 
      name: 'Blue', 
      value: '#3B82F6',      // Blue
      background: '#3B82F625',
      text: '#1D4ED8'        // Darker blue for contrast
    },
    { 
      name: 'Purple', 
      value: '#8B5CF6',      // Violet
      background: '#8B5CF625',
      text: '#6D28D9'        // Darker violet for contrast
    },
    { 
      name: 'Pink', 
      value: '#EC4899',      // Pink
      background: '#EC489925',
      text: '#BE185D'        // Darker pink for contrast
    },
    { 
      name: 'Red', 
      value: '#EF4444',      // Red
      background: '#EF444425',
      text: '#B91C1C'        // Darker red for contrast
    }
  ]
  
  // Fetch latest form if no form is selected
  useEffect(() => {
    if (!user?.id) return;
    
    // Always set loading to true when this effect starts running
    setLoading(true);
    
    // If initialFormId is provided, we don't need to fetch the latest form
    if (initialFormId) {
      setSelectedFormId(initialFormId);
      setFormsChecked(true);
      setLoading(false);
      return;
    }
    
    const fetchLatestForm = async () => {
      try {
        const { data, error } = await supabase
          .from('forms')
          .select('id')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          setSelectedFormId(data[0].id);
        } else {
          // Also check for collaborator forms
          const { data: collabData, error: collabError } = await supabase
            .rpc('get_user_collaboration_forms', { 
              user_id_param: user.id 
            });
          
          if (!collabError && collabData && Array.isArray(collabData) && collabData.length > 0) {
            // User has collaborative forms, set the first one
            setSelectedFormId(collabData[0]);
          } else {
            // No forms owned or collaborated on
            setSelectedFormId(undefined);
          }
        }
      } catch (error) {
        console.error('Error fetching latest form:', error);
      } finally {
        setFormsChecked(true);
        setLoading(false);
      }
    };
    
    fetchLatestForm();
  }, [user?.id, initialFormId]);

  // Check if we should show instructions for this form
  useEffect(() => {
    if (selectedFormId) {
      // Only show instructions automatically if:
      // 1. This is the first form (no other forms exist)
      // 2. User hasn't seen instructions for this form before
      const showInstructions = async () => {
        // Check if user has other forms
        const { count } = await supabase
          .from('forms')
          .select('id', { count: 'exact' })
          .eq('owner_id', user?.id);
        
        const isFirstForm = count === 1;
        
        // Check if instructions have been shown before
        const key = `instructions-shown-${selectedFormId}`;
        const hasShown = localStorage.getItem(key);
        
        if (!hasShown && isFirstForm) {
          setShouldShowInstructions(true);
          localStorage.setItem(key, 'true');
        }
      }
      
      showInstructions();
    }
  }, [selectedFormId, user?.id])

  // Fetch form name when form is selected
  useEffect(() => {
    if (selectedFormId && user?.id) {
      const fetchFormDetails = async () => {
        // First try to fetch as owner
        let { data, error } = await supabase
          .from('forms')
          .select('url, product_name, button_color, support_text, keyboard_shortcut, sound_enabled, show_gif_on_success, gif_urls, remove_branding')
          .eq('id', selectedFormId)
          .eq('owner_id', user.id)
          .single();

        // If no data found or error occurred, the user might be a collaborator
        if (!data || error) {
          // Check if user has access to this form
          const { data: hasAccess } = await supabase
            .rpc('user_has_form_access', {
              form_id_param: selectedFormId,
              user_id_param: user.id
            });

          if (hasAccess) {
            // User has collaborative access, fetch form details
            const { data: formData, error: formError } = await supabase
              .from('forms')
              .select('url, product_name, button_color, support_text, keyboard_shortcut, sound_enabled, show_gif_on_success, gif_urls, remove_branding')
              .eq('id', selectedFormId)
              .single();

            if (!formError && formData) {
              data = formData;
            }
          }
        }

        if (data) {
          setFormName(data.url);
          setProductName(data.product_name);
          setButtonColor(data.button_color);
          setSupportText(data.support_text);
          setKeyboardShortcut(data.keyboard_shortcut);
          setSoundEnabled(data.sound_enabled);
          setShowGifOnSuccess(data.show_gif_on_success);
          setGifUrls(data.gif_urls || []);
          setRemoveBranding(data.remove_branding);
        }
      };

      fetchFormDetails();
    }
  }, [selectedFormId, user?.id]);

  // Update URL when form selection changes
  useEffect(() => {
    if (selectedFormId) {
      // Only update URL if there's no selected response (with ticket number)
      // This prevents overwriting the URL with ticket number
      if (!selectedResponse) {
        navigate(`/forms/${selectedFormId}`, { replace: true });
      }
    } else if (formsChecked && !loading) {
      navigate('/', { replace: true });
    }
  }, [selectedFormId, navigate, loading, formsChecked, selectedResponse]);

  // Check if form has any responses
  useEffect(() => {
    if (selectedFormId) {
      supabase
        .from('feedback')
        .select('id', { count: 'exact' })
        .eq('form_id', selectedFormId)
        .then(({ count }) => {
          setHasResponses(!!count && count > 0)
        })
    }
  }, [selectedFormId])

  // Fetch feedback counts
  useEffect(() => {
    if (!selectedFormId) {
      setFeedbackCounts({ open: 0, closed: 0 });
      return;
    }
    
    const fetchCounts = async () => {
      try {
        // Get open feedback count
        const { count: openCount } = await supabase
          .from('feedback')
          .select('id', { count: 'exact' })
          .eq('form_id', selectedFormId)
          .eq('status', 'open');
          
        // Get closed feedback count
        const { count: closedCount } = await supabase
          .from('feedback')
          .select('id', { count: 'exact' })
          .eq('form_id', selectedFormId)
          .eq('status', 'closed');
          
        setFeedbackCounts({
          open: openCount || 0,
          closed: closedCount || 0
        });
      } catch (error) {
        console.error('Error fetching feedback counts:', error);
      }
    };
    
    fetchCounts();
    
    // Set up subscription to feedback changes
    const feedbackChannel = supabase
      .channel(`feedback_counts_${selectedFormId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'feedback',
        filter: `form_id=eq.${selectedFormId}`
      }, () => {
        // Refetch counts when feedback changes
        fetchCounts();
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(feedbackChannel);
    };
  }, [selectedFormId]);
  
  // Handle filter change from both sidebar and table
  const handleFilterChange = (filter: typeof activeFilter) => {
    setActiveFilter(filter);
    // Clear selected response when changing filters
    setSelectedResponse(null);
    
    // Notify the FeedbackInbox to clear active feedback
    localStorage.setItem('clearSelectedFeedback', 'true');
    // Clear it immediately after to avoid polluting localStorage
    setTimeout(() => {
      localStorage.removeItem('clearSelectedFeedback');
    }, 100);
  };

  const handleExport = useCallback(async () => {
    if (!selectedFormId) return

    try {
      const { data, error } = await supabase
        .from('feedback')
        .select('message, user_id, user_email, user_name, operating_system, screen_category, created_at')
        .eq('form_id', selectedFormId)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Convert to CSV
      const csvContent = [
        ['Message', 'User ID', 'User Email', 'User Name', 'Operating System', 'Device', 'Date'],
        ...(data || []).map(row => [
          `"${row.message.replace(/"/g, '""')}"`,
          row.user_id || '',
          row.user_email || '',
          row.user_name || '',
          row.operating_system,
          row.screen_category,
          new Date(row.created_at).toLocaleString()
        ])
      ].join('\n')

      // Create and trigger download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const date = new Date().toISOString().split('T')[0]
      link.href = URL.createObjectURL(blob)
      link.download = `${formName}-${date}.csv`
      link.click()
    } catch (error) {
      console.error('Error exporting responses:', error)
    }
  }, [selectedFormId, formName])

  const handleDelete = useCallback(async () => {
    try {
      const { error: deleteError } = await supabase
        .from('forms')
        .delete()
        .eq('id', selectedFormId)
      
      if (deleteError) throw deleteError
      
      // After deleting, fetch the next latest form
      const { data } = await supabase
        .from('forms')
        .select('id')
        .eq('owner_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (data && data.length > 0) {
        setSelectedFormId(data[0].id);
      } else {
        setSelectedFormId(undefined);
      }
    } catch (error) {
      console.error('Error deleting form:', error)
    }
  }, [selectedFormId, user?.id])

  // Handle batch status change
  const handleBatchStatusChange = async (ids: string[], status: 'open' | 'closed') => {
    if (!ids.length) return;
    
    try {
      // Update the status for all selected items in Supabase
      const { error } = await supabase
        .from('feedback')
        .update({ status })
        .in('id', ids);
      
      if (error) throw error;
      
      // Clear selection after batch action
      setSelectedBatchIds([]);
      
      // Update selected response if it's in the batch
      if (selectedResponse && ids.includes(selectedResponse.id)) {
        setSelectedResponse({
          ...selectedResponse,
          status
        });
      }
      
      // Skip loading state when refreshing the inbox
      if (inboxRef.current) {
        await inboxRef.current.refreshData(true);
      }
    } catch (error) {
      console.error('Error batch updating status:', error);
    }
  };

  // Helper function to get a random tag color from the color options
  const getRandomTagColor = () => {
    const randomIndex = Math.floor(Math.random() * colorOptions.length);
    return colorOptions[randomIndex].value;
  };

  // Handle batch tag change
  const handleBatchTagChange = async (ids: string[], tagId: string | null) => {
    if (!ids.length) return;
    
    try {
      // Update the tag_id for all selected items in Supabase
      const { error } = await supabase
        .from('feedback')
        .update({ tag_id: tagId })
        .in('id', ids);
      
      if (error) throw error;
      
      // Clear selection after batch action
      setSelectedBatchIds([]);
      
      // Update selected response if it's in the batch
      if (selectedResponse && ids.includes(selectedResponse.id)) {
        // Find the tag object if a tag was applied
        let updatedTag = null;
        if (tagId) {
          const matchingTag = availableTags.find(tag => tag.id === tagId);
          if (matchingTag) {
            updatedTag = matchingTag;
          }
        }
        
        setSelectedResponse({
          ...selectedResponse,
          tag_id: tagId,
          tag: updatedTag
        });
      }
      
      // Skip loading state when refreshing the inbox
      if (inboxRef.current) {
        await inboxRef.current.refreshData(true);
      }
    } catch (error) {
      console.error('Error batch updating tags:', error);
    }
  };

  // Update existing handleResponseStatusChange to reset batch selections on individual updates
  const handleResponseStatusChange = async (id: string, status: 'open' | 'closed') => {
    try {
      // Update the status in Supabase
      await supabase
        .from('feedback')
        .update({ status })
        .eq('id', id);
      
      // Update selected response if it's the one that changed
      if (selectedResponse && selectedResponse.id === id) {
        setSelectedResponse({
          ...selectedResponse,
          status
        });
      }
      
      // Clear any batch selections when updating individual items
      setSelectedBatchIds([]);
      
      // Skip loading state when refreshing the inbox
      if (inboxRef.current) {
        await inboxRef.current.refreshData(true);
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  // Handle assigning feedback to a team member
  const handleAssigneeChange = async (id: string, assigneeId: string | null) => {
    try {
      console.log('Starting assignment process:', { id, assigneeId });
      
      const currentUser = user?.id;
      if (!currentUser) {
        throw new Error('No user found');
      }
      
      console.log('Current user ID for assignment:', currentUser);
      
      // Use the assignFeedback function to update assignee and create assignment event
      const success = await assignFeedback(
        id, 
        assigneeId, 
        currentUser,  // This is now sender_id (previously assigned_by)
        { source: 'dashboard' }
      );
      
      console.log('Assignment result:', success);
      
      if (!success) {
        throw new Error('Failed to assign feedback');
      }
      
      // Update selected response if it's the one that changed
      if (selectedResponse && selectedResponse.id === id) {
        // Find the collaborator to get their details
        const collaborator = assigneeId 
          ? collaborators.find(c => c.user_id === assigneeId)
          : null;
          
        console.log('Selected collaborator for assignment:', collaborator);
          
        if (collaborator) {
          setSelectedResponse({
            ...selectedResponse,
            assignee_id: assigneeId,
            assignee: {
              id: collaborator.user_id,
              email: collaborator.user_profile?.email || collaborator.invitation_email,
              user_name: collaborator.user_profile?.username || collaborator.invitation_email.split('@')[0],
              avatar_url: collaborator.user_profile?.avatar_url || undefined
            }
          });
        } else {
          setSelectedResponse({
            ...selectedResponse,
            assignee_id: null,
            assignee: null
          });
        }
      }
      
      // Clear any batch selections when updating individual items
      setSelectedBatchIds([]);
      
      // Skip loading state when refreshing the inbox
      if (inboxRef.current) {
        await inboxRef.current.refreshData(true);
      }
    } catch (error) {
      console.error('Error updating assignee:', error);
      toast.error("Failed to assign feedback");
    }
  };

  const handleResponseDelete = async (id: string) => {
    setFeedbackToDelete(id);
    setShowDeleteConfirmation(true);
  };

  const confirmDelete = async () => {
    if (!feedbackToDelete) return;
    
    try {
      const { error } = await supabase
        .from('feedback')
        .delete()
        .eq('id', feedbackToDelete);

      if (error) throw error;
      
      // Clear the selected response if it was deleted
      if (selectedResponse && selectedResponse.id === feedbackToDelete) {
        setSelectedResponse(null);
        
        // Notify the FeedbackInbox to clear active feedback
        localStorage.setItem('clearSelectedFeedback', 'true');
        // Clear it immediately after to avoid polluting localStorage
        setTimeout(() => {
          localStorage.removeItem('clearSelectedFeedback');
        }, 100);
      }
      
      // Skip loading state when refreshing the inbox
      if (inboxRef.current) {
        await inboxRef.current.refreshData(true);
      }
      
      toast.success("Feedback deleted successfully");
    } catch (error) {
      console.error('Error deleting response:', error);
      toast.error("Failed to delete feedback");
    } finally {
      setShowDeleteConfirmation(false);
      setFeedbackToDelete(null);
    }
  };

  // Handle tag change for a single feedback
  const handleTagChange = async (id: string, tagName: string | null) => {
    try {
      let tagId = null;
      
      // Find tag id from the name
      if (tagName) {
        const matchingTag = availableTags.find(tag => tag.name === tagName);
        if (matchingTag) {
          tagId = matchingTag.id;
        } else {
          // If tag doesn't exist, create it
          const { data: newTag, error: createError } = await supabase
            .from('feedback_tags')
            .insert({
              name: tagName,
              color: getRandomTagColor(),
              form_id: selectedFormId
            })
            .select('*')
            .single();
            
          if (createError) throw createError;
          if (newTag) {
            tagId = newTag.id;
            // Add to available tags for immediate use
            setAvailableTags(prev => [...prev, newTag]);
          }
        }
      }
      
      // Update feedback with the tag_id
      const { error } = await supabase
        .from('feedback')
        .update({ tag_id: tagId })
        .eq('id', id);
      
      if (error) throw error;
      
      // Update the selected response if it's the one that changed
      if (selectedResponse && selectedResponse.id === id) {
        const updatedTag = tagId 
          ? availableTags.find(tag => tag.id === tagId) || null
          : null;
          
        setSelectedResponse({
          ...selectedResponse,
          tag_id: tagId,
          tag: updatedTag
        });
      }
      
      // Skip loading state when refreshing the inbox
      if (inboxRef.current) {
        await inboxRef.current.refreshData(true);
      }
      
      toast.success(tagName ? "Label applied successfully" : "Label removed");
    } catch (error) {
      console.error('Error updating tag:', error);
      toast.error("Failed to update label");
    }
  };

  // Fetch all available tags
  useEffect(() => {
    const fetchTags = async () => {
      if (!selectedFormId) return;
      
      // Fetch only form-specific tags (no longer include global tags)
      const { data, error } = await supabase
        .from('feedback_tags')
        .select('*')
        .eq('form_id', selectedFormId)
        .order('name');
        
      if (error) {
        console.error('Error fetching tags:', error);
      } else {
        setAvailableTags(data || []);
      }
    };
    
    fetchTags();

    // Subscribe to changes to tags
    const channel = supabase
      .channel('tag_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'feedback_tags',
          filter: `form_id=eq.${selectedFormId}`
        },
        async (payload) => {
          // When tag is created, updated or deleted, refresh the tags
          await fetchTags();
          
          // Also update the selected response if its tag was updated
          if (payload.eventType === 'UPDATE' && selectedResponse?.tag_id === payload.new.id) {
            setSelectedResponse(prevResponse => {
              if (!prevResponse) return null;
              return {
                ...prevResponse,
                tag: payload.new as FeedbackTag
              };
            });
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [selectedFormId]);
  
  // Fetch collaborators for the form
  useEffect(() => {
    if (!selectedFormId || !user?.id) return
    
    const fetchCollaborators = async () => {
      try {
        // Fetch collaborators directly from Supabase instead of the Netlify function
        const { data, error } = await supabase
          .from('form_collaborators')
          .select(`
            id, 
            form_id, 
            user_id, 
            role, 
            invited_by, 
            invitation_email, 
            invitation_accepted
          `)
          .eq('form_id', selectedFormId);
        
        if (error) {
          console.error('Error fetching collaborators:', error);
          return;
        }
        
        console.log('Raw collaborators data:', data);
        
        // Get user profile data for each collaborator
        const collaboratorsWithProfiles = await Promise.all(
          (data || []).map(async (collaborator) => {
            console.log('Processing collaborator:', collaborator);
            
            if (collaborator.user_id) {
              // Try to get user profile from auth.users
              try {
                console.log('Fetching profile for user ID:', collaborator.user_id);
                
                const { data: profileData, error: profileError } = await supabase
                  .rpc('get_user_profile_by_id', { user_id_param: collaborator.user_id });
                
                console.log('Profile data response:', profileData, 'Error:', profileError);
                
                if (profileError) {
                  console.error('Error fetching user profile:', profileError);
                  // Continue with basic info from invitation_email
                } else if (profileData && profileData.length > 0) {
                  const profile = profileData[0];
                  console.log('Found user profile:', profile);
                  
                  // Check if the returned profile has the expected fields
                  if (profile && profile.profile_user_id) { 
                    return {
                      ...collaborator,
                      user_profile: {
                        email: profile.email || collaborator.invitation_email,
                        username: profile.username || collaborator.invitation_email?.split('@')[0] || 'Unknown user',
                        avatar_url: profile.avatar_url
                      }
                    };
                  } else {
                    console.warn('Profile data received but missing expected fields:', profile);
                  }
                }
              } catch (err) {
                console.error('Error processing user profile:', err);
                // Continue with basic info
              }
            }
            
            // If no user_id or profile fetch failed, return with basic info
            const emailUsername = collaborator.invitation_email?.split('@')[0] || 'Unknown user';
            return {
              ...collaborator,
              user_profile: {
                email: collaborator.invitation_email,
                username: emailUsername,
                avatar_url: null
              }
            };
          })
        );
        
        console.log('Final collaborators with profiles:', JSON.stringify(collaboratorsWithProfiles, null, 2));
        setCollaborators(collaboratorsWithProfiles || []);
      } catch (error) {
        console.error('Error fetching collaborators:', error);
      }
    };
    
    fetchCollaborators();
  }, [selectedFormId, user?.id]);
  
  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip handling if in an input field or modal or if cmd/ctrl+R is pressed (browser refresh)
      if (!selectedResponse || 
          (event.ctrlKey || event.metaKey) && event.key === 'r' ||
          event.target instanceof HTMLInputElement || 
          event.target instanceof HTMLTextAreaElement ||
          // Add additional checks for Tiptap editor
          (event.target instanceof HTMLElement && 
            (event.target.classList.contains('ProseMirror') || 
             event.target.closest('.ProseMirror') !== null))) {
        return;
      }
      
      // "J" key to go to next ticket
      if (event.key === 'j' || event.key === 'J') {
        event.preventDefault();
        navigateToResponse('next');
      }
      
      // "K" key to go to previous ticket
      if (event.key === 'k' || event.key === 'K') {
        event.preventDefault();
        navigateToResponse('prev');
      }
      
      // "L" key to open tag dropdown
      if (event.key === 'l' || event.key === 'L') {
        event.preventDefault();
        // Click the tag dropdown trigger
        if (tagDropdownTriggerRef.current) {
          tagDropdownTriggerRef.current.click();
          setIsTagDropdownOpen(true);
        }
      }
      
      // "S" key to open status dropdown
      if (event.key === 's' || event.key === 'S') {
        event.preventDefault();
        // Click the status dropdown trigger
        if (statusDropdownTriggerRef.current) {
          statusDropdownTriggerRef.current.click();
          setIsStatusDropdownOpen(true);
        }
      }
      
      // "A" key to open assignee dropdown
      if (event.key === 'a' || event.key === 'A') {
        event.preventDefault();
        // Click the assignee dropdown trigger
        if (assigneeDropdownTriggerRef.current) {
          assigneeDropdownTriggerRef.current.click();
          setIsAssigneeDropdownOpen(true);
        }
      }
      
      // "R" key to focus reply box
      if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        // Focus the reply box if available
        if (conversationThreadRef.current) {
          conversationThreadRef.current.focusReplyBox();
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedResponse]);

  // Handle dropdown state tracking
  const handleTagDropdownOpenChange = (open: boolean) => {
    setIsTagDropdownOpen(open);
  };

  // Handle status dropdown state tracking
  const handleStatusDropdownOpenChange = (open: boolean) => {
    setIsStatusDropdownOpen(open);
    
    // When dropdown is closed, focus on another element (e.g. the trigger)
    // to avoid keyboard focus remaining inside a now-hidden dropdown
    if (!open && statusDropdownTriggerRef.current) {
      statusDropdownTriggerRef.current.focus();
    }
  };

  // Handle assignee dropdown state tracking
  const handleAssigneeDropdownOpenChange = (open: boolean) => {
    setIsAssigneeDropdownOpen(open);
    
    if (open && assigneeSearchInputRef.current) {
      // Focus the search input when the dropdown opens
      setTimeout(() => {
        assigneeSearchInputRef.current?.focus();
      }, 0);
      // Reset focused index when opening
      setFocusedAssigneeIndex(-1);
    } else if (!open && assigneeDropdownTriggerRef.current) {
      // When dropdown is closed, focus on another element (e.g. the trigger)
      // to avoid keyboard focus remaining inside a now-hidden dropdown
      assigneeDropdownTriggerRef.current.focus();
      // Reset search term when dropdown closes
      setAssigneeSearchTerm('');
    }
  };

  // Add quick tag creation function
  const createQuickTag = async () => {
    if (!selectedFormId || !quickTagName.trim()) return;
    
    try {
      const { error } = await supabase
        .from('feedback_tags')
        .insert({
          name: quickTagName.trim(),
          color: quickTagColor,
          form_id: selectedFormId, // Make tag specific to this form
          is_favorite: isQuickTagFavorite
        })
        .select();
      
      if (error) throw error;
      
      // Refresh tags
      const { data: updatedTags, error: tagsError } = await supabase
        .from('feedback_tags')
        .select('*')
        .eq('form_id', selectedFormId)
        .order('name');
        
      if (tagsError) {
        console.error('Error fetching tags:', tagsError);
      } else {
        setAvailableTags(updatedTags || []);
      }
      
      // Reset form
      setQuickTagName('');
      setQuickTagColor('#3B82F6');
      setIsQuickTagFavorite(false);
      setShowAddTagPopover(false);
      
      toast.success("Label created", {
        description: `"${quickTagName}" label has been created.`
      });
    } catch (error: any) {
      console.error('Error creating tag:', error);
      
      // Handle unique constraint error
      if (error.code === '23505') {
        toast.error("Error", {
          description: "A label with this name already exists."
        });
      } else {
        toast.error("Error", {
          description: "Failed to create label."
        });
      }
    }
  };

  const handleUpdateTag = async (tagId: string) => {
    if (!selectedFormId || !editingTag) return;

    try {
      const { error } = await supabase
        .from('feedback_tags')
        .update({
          name: editTagName,
          color: editTagColor,
          is_favorite: editTagIsFavorite
        })
        .eq('id', tagId);

      if (error) throw error;

      // Refresh tags
      const { data: updatedTags } = await supabase
        .from('feedback_tags')
        .select('*')
        .eq('form_id', selectedFormId)
        .order('name');

      if (updatedTags) {
        setAvailableTags(updatedTags);
      }

      // Reset edit state
      setEditingTag(null);
      setEditTagName('');
      setEditTagColor('#3B82F6');
      setEditTagIsFavorite(false);

      toast.success('Label updated successfully');
    } catch (error) {
      console.error('Error updating tag:', error);
      toast.error('Failed to update label');
    }
  };

  // Handle URL navigation when selecting a response
  const handleResponseSelect = (response: FeedbackResponse | null) => {
    let updatedResponse = response;
    
    // Only process if response exists and has an assignee ID but no assignee details
    if (updatedResponse && updatedResponse.assignee_id && !updatedResponse.assignee) {
      // We have an assignee ID but no assignee details, find them
      const assigneeCollaborator = collaborators.find(
        c => c.user_id === updatedResponse?.assignee_id
      );
      
      if (assigneeCollaborator) {
        // Update the response with assignee details before setting it
        updatedResponse = {
          ...updatedResponse,
          assignee: {
            id: assigneeCollaborator.user_id,
            email: assigneeCollaborator.user_profile?.email || assigneeCollaborator.invitation_email,
            user_name: assigneeCollaborator.user_profile?.username || 
                      assigneeCollaborator.invitation_email?.split('@')[0] || 
                      'User',
            avatar_url: assigneeCollaborator.user_profile?.avatar_url || undefined
          }
        };
      }
    }
    
    setSelectedResponse(updatedResponse);
    
    // Update URL to include ticket number if a response is selected
    if (updatedResponse && selectedFormId) {
      navigate(`/forms/${selectedFormId}/ticket/${updatedResponse.ticket_number}`, { replace: true });
    } else if (selectedFormId) {
      // If no response selected, just show form URL
      navigate(`/forms/${selectedFormId}`, { replace: true });
      
      // Notify the FeedbackInbox to clear active feedback
      localStorage.setItem('clearSelectedFeedback', 'true');
      // Clear it immediately after to avoid polluting localStorage
      setTimeout(() => {
        localStorage.removeItem('clearSelectedFeedback');
      }, 100);
    }
  };

  // Use initialTicketNumber to load the correct feedback
  useEffect(() => {
    // Skip if no form ID or ticket number
    if (!selectedFormId || !initialTicketNumber) return;

    const fetchTicket = async () => {
      try {
        // Find feedback with matching ticket number
        const { data, error } = await supabase
          .from('feedback')
          .select('*')
          .eq('form_id', selectedFormId)
          .eq('ticket_number', initialTicketNumber)
          .limit(1);

        if (error) throw error;

        if (data && data.length > 0) {
          let responseData = data[0];
          
          // Store the initial response ID for the FeedbackInbox component
          setInitialResponseId(responseData.id);
          
          // Fetch tag if it exists
          if (responseData.tag_id) {
            const { data: tagData } = await supabase
              .from('feedback_tags')
              .select('*')
              .eq('id', responseData.tag_id)
              .limit(1);

            if (tagData && tagData.length > 0) {
              responseData = {
                ...responseData,
                tag: tagData[0]
              };
            }
          }
          
          // Fetch assignee details if assigned
          if (responseData.assignee_id) {
            // Try to find matching collaborator
            const assigneeCollaborator = collaborators.find(c => c.user_id === responseData.assignee_id);
            
            if (assigneeCollaborator) {
              responseData = {
                ...responseData,
                assignee: {
                  id: assigneeCollaborator.user_id,
                  email: assigneeCollaborator.user_profile?.email || assigneeCollaborator.invitation_email,
                  user_name: assigneeCollaborator.user_profile?.username || 
                            assigneeCollaborator.invitation_email?.split('@')[0] || 
                            'User',
                  avatar_url: assigneeCollaborator.user_profile?.avatar_url || undefined
                }
              };
            } else {
              // Fallback to basic assignee data if collaborator not found
              try {
                const { data: userData } = await supabase
                  .rpc('get_user_profile_by_id', { user_id_param: responseData.assignee_id });
                
                if (userData && userData.length > 0) {
                  const userProfile = userData[0];
                  responseData = {
                    ...responseData,
                    assignee: {
                      id: responseData.assignee_id,
                      email: userProfile.email || 'user@example.com',
                      user_name: userProfile.username || userProfile.email?.split('@')[0] || 'User',
                      avatar_url: userProfile.avatar_url || undefined
                    }
                  };
                }
              } catch (err) {
                console.error('Error fetching assignee details:', err);
              }
            }
          }
          
          // Set the response with all the details
          setSelectedResponse(responseData);
          
          // Also ensure the FeedbackInbox component knows about the active response
          // This is the key fix - ensuring the inbox component has the active response set
          if (inboxRef.current && inboxRef.current.setActiveResponse) {
            // We need to wait until the inbox has loaded its data
            setTimeout(() => {
              inboxRef.current?.setActiveResponse(responseData.id);
            }, 500); // Give the inbox component time to load
          }
        }
      } catch (error) {
        console.error('Error fetching ticket:', error);
      }
    };

    fetchTicket();
  }, [selectedFormId, initialTicketNumber, collaborators]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="fixed left-0 w-[240px] h-screen border-r bg-[#FAFAFA]">
        <div className="flex flex-col h-full">
          <FormsDropdown 
            selectedFormId={selectedFormId}
            onFormSelect={setSelectedFormId}
            onNewFormClick={() => setShowNewFormDialog(true)}
          />
          <div className="flex-1 group py-2">
            {selectedFormId && (
              <nav className="grid gap-0.5 px-2">
                <a 
                  href="#"
                  className={cn(
                    "inline-flex items-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 h-8 rounded-md px-3 justify-start",
                    activeFilter === 'open'
                      ? "bg-accent text-accent-foreground hover:bg-accent/90"
                      : "hover:bg-accent hover:text-accent-foreground"
                  )}
                  onClick={(e) => {
                    e.preventDefault();
                    handleFilterChange('open');
                  }}
                >
                  <Inbox className="mr-2 h-4 w-4" />
                  Inbox
                  <span className={cn(
                    "ml-auto tabular-nums text-xs text-muted-foreground",
                    activeFilter === 'open' 
                      ? "text-accent-foreground"
                      : ""
                  )}>
                    {feedbackCounts.open}
                  </span>
                </a>
                
                <a 
                  href="#"
                  className={cn(
                    "inline-flex items-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 h-8 rounded-md px-3 justify-start",
                    activeFilter === 'closed'
                      ? "bg-accent text-accent-foreground hover:bg-accent/90"
                      : "hover:bg-accent hover:text-accent-foreground"
                  )}
                  onClick={(e) => {
                    e.preventDefault();
                    handleFilterChange('closed');
                  }}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Closed
                </a>
              </nav>
            )}
            {selectedFormId && availableTags.length > 0 && (
              <div className="mt-5 px-2">
                <div className="flex justify-between items-center mb-1 pl-3 group/header">
                  <p className="text-xs uppercase text-muted-foreground font-medium tracking-wider">Favorite Labels</p>
                  <div className="flex items-center gap-1 opacity-0 group-hover/header:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:bg-accent-foreground/10"
                      onClick={() => setShowTagManagerDialog(true)}
                    >
                      <Settings2 className="h-4 w-4" />
                    </Button>
                    <Popover open={showAddTagPopover} onOpenChange={setShowAddTagPopover}>
                      <PopoverTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 w-6 p-0 text-muted-foreground hover:bg-accent-foreground/10"
                          onClick={() => setShowAddTagPopover(true)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80" side="right">
                        <div className="space-y-4">
                          <div className="font-medium text-sm">Create New Label</div>
                          <div className="space-y-2">
                            <Label htmlFor="quick-tag-name">Label Name</Label>
                            <Input 
                              id="quick-tag-name"
                              value={quickTagName}
                              onChange={e => setQuickTagName(e.target.value)}
                              placeholder="e.g., Feature Request"
                              className="w-full"
                              autoFocus
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Label Color</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className="w-full justify-between"
                                >
                                  <div className="flex items-center">
                                    <div
                                      className="w-4 h-4 rounded border"
                                      style={{ 
                                        backgroundColor: `${quickTagColor}30`,
                                        borderColor: `${quickTagColor}70`
                                      }}
                                    />
                                    <span className="ml-2 text-sm text-foreground">
                                      {colorOptions.find(c => c.value === quickTagColor)?.name || 'Select color'}
                                    </span>
                                  </div>
                                  <ChevronDown className="h-4 w-4 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-48 p-0" align="start">
                                <div className="flex flex-col py-1">
                                  {colorOptions.map(color => (
                                    <button
                                      key={color.value}
                                      type="button"
                                      onClick={() => setQuickTagColor(color.value)}
                                      className={cn(
                                        "flex items-center gap-2 w-full px-3 py-1.5 hover:bg-accent text-left",
                                        quickTagColor === color.value ? "bg-accent" : ""
                                      )}
                                    >
                                      <div 
                                        className="w-5 h-5 rounded border" 
                                        style={{ 
                                          backgroundColor: `${color.value}30`,
                                          borderColor: `${color.value}70`
                                        }}
                                      />
                                      <span className="text-sm text-foreground">{color.name}</span>
                                      {quickTagColor === color.value && (
                                        <Check className="h-4 w-4 ml-auto" />
                                      )}
                                    </button>
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                          
                          <div className="flex items-center space-x-2 pt-2">
                            <input
                              type="checkbox"
                              id="is-quick-tag-favorite"
                              checked={isQuickTagFavorite}
                              onChange={e => setIsQuickTagFavorite(e.target.checked)}
                              className="rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <Label htmlFor="is-quick-tag-favorite" className="text-sm font-normal flex items-center">
                              Add to favorites <Star className="h-3 w-3 ml-1 text-amber-500" />
                            </Label>
                          </div>
                          
                          <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" type="button" onClick={() => {
                              setQuickTagName('');
                              setQuickTagColor('#3B82F6');
                              setIsQuickTagFavorite(false);
                              setShowAddTagPopover(false);
                            }}>
                              Cancel
                            </Button>
                            <Button onClick={() => {
                              createQuickTag();
                              setShowAddTagPopover(false);
                            }} disabled={!quickTagName.trim()}>
                              Create Label
                            </Button>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <nav className="grid gap-0.5 px-0">
                  {availableTags
                    .filter(tag => tag.is_favorite)
                    .map(tag => (
                    <div
                      key={tag.id}
                      className={cn(
                        "flex items-center gap-2 whitespace-nowrap text-sm font-medium h-8 rounded-md px-3 transition-colors group/row",
                        typeof activeFilter === 'object' && activeFilter.id === tag.id
                          ? "bg-accent text-accent-foreground hover:bg-accent/90"
                          : "hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <a
                        href="#"
                        className="flex items-center gap-2 min-w-0 flex-1"
                        onClick={(e) => {
                          e.preventDefault();
                          handleFilterChange({ type: 'tag', id: tag.id, name: tag.name });
                        }}
                      >
                        <Tag 
                          className="h-3 w-3 flex-shrink-0" 
                          style={{ 
                            color: tag.color,
                            fill: `${tag.color}30`,
                            stroke: tag.color
                          }} 
                        />
                        <span className="truncate">{tag.name}</span>
                      </a>
                      <Popover open={editingTag?.id === tag.id} onOpenChange={(open) => {
                        if (!open) {
                          setEditingTag(null);
                          setEditTagName('');
                          setEditTagColor('#3B82F6');
                          setEditTagIsFavorite(false);
                        }
                      }}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 opacity-0 group-hover/row:opacity-100 transition-all hover:bg-accent-foreground/10 flex-shrink-0"
                            onClick={() => {
                              setEditingTag(tag);
                              setEditTagName(tag.name);
                              setEditTagColor(tag.color);
                              setEditTagIsFavorite(tag.is_favorite);
                            }}
                          >
                            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80" side="right">
                          <div className="space-y-4">
                            <div className="font-medium text-sm">Edit Label</div>
                            <div className="space-y-2">
                              <Label htmlFor="edit-tag-name">Label Name</Label>
                              <Input 
                                id="edit-tag-name"
                                value={editTagName}
                                onChange={e => setEditTagName(e.target.value)}
                                placeholder="e.g., Feature Request"
                                className="w-full"
                              />
                            </div>
                            
                            <div className="space-y-2">
                              <Label>Label Color</Label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    className="w-full justify-between"
                                  >
                                    <div className="flex items-center">
                                      <div
                                        className="w-4 h-4 rounded border"
                                        style={{ 
                                          backgroundColor: `${editTagColor}30`,
                                          borderColor: `${editTagColor}70`
                                        }}
                                      />
                                      <span className="ml-2 text-sm text-foreground">
                                        {colorOptions.find(c => c.value === editTagColor)?.name || 'Select color'}
                                      </span>
                                    </div>
                                    <ChevronDown className="h-4 w-4 opacity-50" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-48 p-0" align="start">
                                  <div className="flex flex-col py-1">
                                    {colorOptions.map(color => (
                                      <button
                                        key={color.value}
                                        type="button"
                                        onClick={() => setEditTagColor(color.value)}
                                        className={cn(
                                          "flex items-center gap-2 w-full px-3 py-1.5 hover:bg-accent text-left cursor-pointer",
                                          editTagColor === color.value && "bg-accent"
                                        )}
                                      >
                                        <div 
                                          className="w-5 h-5 rounded border" 
                                          style={{ 
                                            backgroundColor: `${color.value}30`,
                                            borderColor: `${color.value}70`
                                          }}
                                        />
                                        <span className="text-sm text-foreground">{color.name}</span>
                                        {editTagColor === color.value && (
                                          <Check className="h-4 w-4 ml-auto" />
                                        )}
                                      </button>
                                    ))}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="edit-is-favorite-tag"
                                checked={editTagIsFavorite}
                                onChange={e => setEditTagIsFavorite(e.target.checked)}
                                className="rounded border-gray-300 text-primary focus:ring-primary"
                              />
                              <Label htmlFor="edit-is-favorite-tag" className="text-sm font-normal flex items-center">
                                Add to favorites <Star className="h-3 w-3 ml-1 text-amber-500" />
                              </Label>
                            </div>
                            
                            <div className="flex justify-end gap-2 pt-2">
                              <Button variant="outline" type="button" onClick={() => {
                                setEditingTag(null);
                                setEditTagName('');
                                setEditTagColor('#3B82F6');
                                setEditTagIsFavorite(false);
                              }}>
                                Cancel
                              </Button>
                              <Button onClick={() => {
                                handleUpdateTag(tag.id);
                              }} disabled={!editTagName.trim()}>
                                Update Label
                              </Button>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  ))}
                </nav>
              </div>
            )}
          </div>
          
          {/* Form Action Buttons */}
          {selectedFormId && (
            <div className="px-3 pb-3 pt-1 space-y-1">
              <Button
                variant="ghost"
                className="inline-flex items-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 h-8 rounded-md px-3 justify-start w-full"
                onClick={() => setShowSettingsDialog(true)}
              >
                <Settings2 className="mr-2 h-4 w-4" />
                Settings
              </Button>
              
              <Button
                variant="ghost"
                className="inline-flex items-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 h-8 rounded-md px-3 justify-start w-full"
                onClick={handleExport}
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
              
              {!hasResponses && (
                <Button
                  variant="ghost"
                  className="inline-flex items-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 h-8 rounded-md px-3 justify-start w-full"
                  onClick={() => setShowInstallModal(true)}
                >
                  <Code2 className="mr-2 h-4 w-4" />
                  Install Instructions
                </Button>
              )}
            </div>
          )}
          
          <UserMenu />
        </div>
        {showFeedbackHint && (
          <div className="absolute bottom-[5.5rem] right-[-2rem] flex flex-col items-end gap-2 try-me-container">
            <img 
              src="/try-me.svg" 
              alt="Try me!"
              className="text-muted-foreground pb-[0.6rem] translate-x-[5.5rem] w-44 rotate-[10deg]"
            />
            <svg 
              width="50" 
              height="32" 
              viewBox="0 0 200 126" 
              fill="none" 
              className="text-muted-foreground -rotate-[21deg] scale-x-100"
            >
              <path 
                d="M193.657 0.316911C192.905 3.37782 191.58 6.26578 191.116 9.41317C187.582 37.1508 172.457 58.1092 152.678 75.7867C145.87 81.8755 136.835 86.5107 127.924 89.1482C102.61 97.0185 76.6195 98.7366 50.4939 93.5265C42.9619 92.0399 35.5689 89.0299 28.5168 84.8703C30.9676 84.5129 33.6046 84.0551 36.1564 83.8847C43.5248 83.287 50.994 82.8763 58.3467 81.8043C61.4568 81.3325 64.6207 79.6246 67.4977 77.8303C68.6144 77.2275 69.3813 74.6409 68.9619 73.4189C68.5426 72.1968 66.316 70.7433 65.2845 71.0587C46.8412 74.7376 28.0235 72.825 9.35372 72.5224C2.81504 72.4308 0.0547017 74.8864 0.545756 81.1392C1.90905 96.5773 6.6538 111.156 14.3921 124.601C14.5939 124.975 15.6411 125.134 17.3632 125.653C26.1241 115.613 16.3161 105.457 16.5673 93.0102C19.0809 94.5502 21.0206 95.9173 22.9445 96.81C62.0352 113.127 101.391 111.678 140.524 97.7968C146.426 95.8181 152.18 92.2294 157.259 88.2809C175.814 73.6783 189.412 55.234 196.717 32.7025C199.034 25.4171 199.24 17.3395 199.648 9.63571C199.926 6.58879 198.211 3.41088 197.357 0.4924C196.123 0.433904 194.89 0.375408 193.657 0.316911Z" 
                fill="currentColor"
              />
            </svg>
          </div>
        )}
      </aside>
      <main className="ml-[240px] flex-1 flex overflow-hidden h-screen">
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Loader className="h-10 w-10 animate-spin mx-auto text-primary mb-4" />
              <p className="text-muted-foreground">Loading your dashboard...</p>
            </div>
          </div>
        )}
        
        {!loading && selectedFormId && (
          <>
            <div className="w-[30%] inbox-wrapper flex flex-col min-w-0 h-full overflow-hidden" style={{ maxWidth: "400px" }}>
              <header className="border-b border-border sticky top-0 bg-background z-10">
                <div className="container py-4 px-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base truncate flex items-center gap-2">
                      {typeof activeFilter === 'object' && activeFilter.type === 'tag' 
                        ? `Tag: ${activeFilter.name}`
                        : activeFilter === 'open' 
                          ? <>
                              <Inbox className="h-4 w-4" />
                              <span>Inbox</span>
                            </>
                          : activeFilter === 'closed' 
                            ? 'Closed' 
                            : 'All Feedback'}
                    </h2>
                    <div className="flex gap-2">
                      {/* Buttons moved to sidebar */}
                    </div>
                  </div>
                </div>
              </header>
              <div className="overflow-y-auto flex-1 h-[calc(100vh-65px)]">
                <div>
                  <FeedbackInbox 
                    ref={inboxRef}
                    formId={selectedFormId} 
                    statusFilter={typeof activeFilter === 'object' ? 'all' : activeFilter}
                    tagFilter={typeof activeFilter === 'object' ? activeFilter.id : undefined}
                    onResponseSelect={handleResponseSelect}
                    onSelectionChange={setSelectedBatchIds}
                    initialActiveResponseId={initialResponseId || selectedResponse?.id}
                  />
                </div>
              </div>
            </div>
            
            {selectedResponse ? (
              <>
                <div className="flex-1 conversation-wrapper border-l min-w-0 overflow-hidden h-full flex flex-col">
                  <header className="border-b border-border">
                    <div className="container py-3 px-4">
                      <div className="flex items-center justify-between">
                        <h2 className="text-base truncate flex items-center gap-2">
                          Ticket #{selectedResponse.ticket_number || '-'}
                          <div className="flex items-center gap-1 ml-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => navigateToResponse('prev')}
                                  >
                                    <ArrowUp className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  Prev. ticket <span className="px-1 py-0.5 bg-muted rounded-sm text-[10px] font-medium">K</span>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => navigateToResponse('next')}
                                  >
                                    <ArrowDown className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  Next ticket <span className="px-1 py-0.5 bg-muted rounded-sm text-[10px] font-medium">J</span>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </h2>
                        <div className="flex gap-2">
                          <DropdownMenu open={isStatusDropdownOpen} onOpenChange={handleStatusDropdownOpenChange}>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                ref={statusDropdownTriggerRef}
                                variant="outline" 
                                size="sm"
                                className={`${
                                  selectedResponse.status === 'open' 
                                    ? 'text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100' 
                                    : 'text-green-600 border-green-200 bg-green-50 hover:bg-green-100 hover:text-green-700'
                                }`}
                              >
                                <div className="flex items-center">
                                  {selectedResponse.status === 'open' ? (
                                    <Circle className="h-3 w-3 mr-2 fill-blue-100 text-blue-600" />
                                  ) : (
                                    <Check className="h-4 w-4 mr-2 text-green-500" />
                                  )}
                                  {selectedResponse.status === 'open' ? 'Open' : 'Closed'}
                                  <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                                    selectedResponse.status === 'open' 
                                      ? 'bg-blue-100 text-blue-600' 
                                      : 'bg-green-100 text-green-600'
                                  }`}>
                                    S
                                  </span>
                                </div>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" 
                              onKeyDown={(e) => {
                                // Handle enter key to select the focused item
                                if (e.key === 'Enter') {
                                  const focusedItem = document.querySelector('[data-radix-dropdown-item][data-highlighted]') as HTMLElement;
                                  if (focusedItem) {
                                    focusedItem.click();
                                  }
                                }
                              }}
                            >
                              <DropdownMenuItem 
                                className="flex items-center cursor-pointer"
                                onClick={() => handleResponseStatusChange(selectedResponse.id, 'open')}
                              >
                                <Circle className="h-3 w-3 mr-2 fill-blue-100 text-blue-600" />
                                <span>Open</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="flex items-center cursor-pointer"
                                onClick={() => handleResponseStatusChange(selectedResponse.id, 'closed')}
                              >
                                <Check className="h-4 w-4 mr-2 text-green-500" />
                                <span>Closed</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          
                          <Popover open={isAssigneeDropdownOpen} onOpenChange={handleAssigneeDropdownOpenChange}>
                            <PopoverTrigger asChild>
                              <Button 
                                ref={assigneeDropdownTriggerRef}
                                variant="outline" 
                                size="sm"
                                className="text-purple-600 border-purple-200 bg-purple-50 hover:bg-purple-100 justify-between"
                              >
                                <div className="flex items-center">
                                  {selectedResponse.assignee ? (
                                    <>
                                      {/* If we have an avatar URL from the assignee, display it */}
                                      {selectedResponse.assignee.avatar_url ? (
                                        <img 
                                          src={selectedResponse.assignee.avatar_url} 
                                          alt={selectedResponse.assignee.user_name || ''} 
                                          className="h-5 w-5 rounded-full mr-2"
                                        />
                                      ) : (
                                        <UserCircle className="h-4 w-4 mr-2 text-purple-500" />
                                      )}
                                      {selectedResponse.assignee.user_name || selectedResponse.assignee.email.split('@')[0]}
                                    </>
                                  ) : (
                                    <>
                                      <UserCircle className="h-4 w-4 mr-2 text-purple-500" />
                                      Assign
                                    </>
                                  )}
                                </div>
                                <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-600 mr-1">
                                  A
                                </span>
                                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[200px] p-0">
                              <div className="bg-popover rounded-md overflow-hidden">
                                <div className="flex items-center border-b px-3">
                                  <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                  <input 
                                    ref={assigneeSearchInputRef}
                                    className="flex h-9 w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
                                    placeholder="Search members..."
                                    value={assigneeSearchTerm}
                                    onChange={(e) => setAssigneeSearchTerm(e.target.value)}
                                    onKeyDown={(e) => {
                                      const filteredCollaborators = collaborators
                                        .filter(c => c.invitation_accepted)
                                        .filter(c => {
                                          if (!assigneeSearchTerm.trim()) return true;
                                          const searchLower = assigneeSearchTerm.toLowerCase();
                                          const username = c.user_profile?.username?.toLowerCase() || '';
                                          const email = c.invitation_email.toLowerCase();
                                          return username.includes(searchLower) || email.includes(searchLower);
                                        });

                                      // Handle arrow key navigation
                                      if (e.key === 'ArrowDown') {
                                        e.preventDefault();
                                        const maxIndex = selectedResponse.assignee_id 
                                          ? filteredCollaborators.length 
                                          : filteredCollaborators.length - 1;
                                        setFocusedAssigneeIndex(prev => 
                                          prev < maxIndex ? prev + 1 : 0
                                        );
                                      } else if (e.key === 'ArrowUp') {
                                        e.preventDefault();
                                        const maxIndex = selectedResponse.assignee_id 
                                          ? filteredCollaborators.length 
                                          : filteredCollaborators.length - 1;
                                        setFocusedAssigneeIndex(prev => 
                                          prev > 0 ? prev - 1 : maxIndex
                                        );
                                      } else if (e.key === 'Enter') {
                                        e.preventDefault();
                                        // Check if the unassign option is selected
                                        if (selectedResponse.assignee_id && focusedAssigneeIndex === filteredCollaborators.length) {
                                          handleAssigneeChange(selectedResponse.id, null);
                                          setIsAssigneeDropdownOpen(false);
                                        } 
                                        // Check if a collaborator is selected
                                        else if (focusedAssigneeIndex >= 0 && focusedAssigneeIndex < filteredCollaborators.length) {
                                          const selectedCollaborator = filteredCollaborators[focusedAssigneeIndex];
                                          handleAssigneeChange(selectedResponse.id, selectedCollaborator.user_id);
                                          setIsAssigneeDropdownOpen(false);
                                        }
                                      } else if (e.key === 'Escape') {
                                        // Close the dropdown
                                        e.preventDefault();
                                        setIsAssigneeDropdownOpen(false);
                                      }
                                    }}
                                  />
                                </div>
                                <div className="max-h-[300px] overflow-y-auto p-1">
                                  {collaborators.filter(c => c.invitation_accepted).length === 0 ? (
                                    <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                                      No members found.
                                    </div>
                                  ) : (
                                    <div>
                                      {collaborators
                                        .filter(c => c.invitation_accepted)
                                        .filter(c => {
                                          if (!assigneeSearchTerm.trim()) return true;
                                          const searchLower = assigneeSearchTerm.toLowerCase();
                                          const username = c.user_profile?.username?.toLowerCase() || '';
                                          const email = c.invitation_email.toLowerCase();
                                          return username.includes(searchLower) || email.includes(searchLower);
                                        })
                                        .map((collaborator, index) => (
                                        <div 
                                          key={collaborator.user_id}
                                          className={cn(
                                            "flex items-center px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer",
                                            focusedAssigneeIndex === index ? "bg-accent text-accent-foreground" : ""
                                          )}
                                          onClick={() => {
                                            handleAssigneeChange(selectedResponse.id, collaborator.user_id);
                                            setIsAssigneeDropdownOpen(false);
                                          }}
                                        >
                                          {collaborator.user_profile?.avatar_url ? (
                                            <img 
                                              src={collaborator.user_profile.avatar_url} 
                                              alt={collaborator.user_profile.username}
                                              className="h-5 w-5 rounded-full mr-2"
                                            />
                                          ) : (
                                            <UserCircle className="h-4 w-4 mr-2 text-purple-500" />
                                          )}
                                          <span className="flex-1">{collaborator.user_profile?.username || collaborator.invitation_email}</span>
                                          {selectedResponse.assignee_id === collaborator.user_id && (
                                            <Check className="h-4 w-4 ml-auto" />
                                          )}
                                        </div>
                                      ))}
                                      
                                      {selectedResponse.assignee_id && (
                                        <div 
                                          className={cn(
                                            "flex items-center px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer border-t mt-1 pt-1",
                                            focusedAssigneeIndex === collaborators.filter(c => c.invitation_accepted)
                                              .filter(c => {
                                                if (!assigneeSearchTerm.trim()) return true;
                                                const searchLower = assigneeSearchTerm.toLowerCase();
                                                const username = c.user_profile?.username?.toLowerCase() || '';
                                                const email = c.invitation_email.toLowerCase();
                                                return username.includes(searchLower) || email.includes(searchLower);
                                              }).length ? "bg-accent text-accent-foreground" : ""
                                          )}
                                          onClick={() => {
                                            handleAssigneeChange(selectedResponse.id, null);
                                            setIsAssigneeDropdownOpen(false);
                                          }}
                                        >
                                          Unassign
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    </div>
                  </header>
                  <div className="container px-0 flex-1 h-[calc(100vh-65px)] overflow-hidden">
                    <ConversationThread 
                      ref={conversationThreadRef}
                      response={selectedResponse} 
                      onStatusChange={handleResponseStatusChange}
                      collaborators={collaborators}
                    />
                  </div>
                </div>
                
                <div className="hidden md:block w-[27%] flex-shrink-0 details-wrapper border-l min-w-0 overflow-hidden h-full flex flex-col" style={{ maxWidth: "400px" }}>
                  <header className="border-b border-border">
                    <div className="container py-4 px-4">
                      <div className="flex items-center justify-between">
                        <h2 className="text-base truncate">Details</h2>
                      </div>
                    </div>
                  </header>
                  <div className="container p-4 overflow-y-auto h-[calc(100vh-65px)] flex-1">
                    <div className="space-y-6">
                      {/* Label section */}
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground flex items-center">
                          <span>Label</span>
                          <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded ml-2">L</span>
                        </p>
                        <DropdownMenu open={isTagDropdownOpen} onOpenChange={handleTagDropdownOpenChange}>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              ref={tagDropdownTriggerRef}
                              variant="outline"
                              className="w-full justify-between"
                            >
                              {selectedResponse.tag ? (
                                <div className="flex items-center">
                                  <div 
                                    className="w-3 h-3 rounded-full mr-2" 
                                    style={{ backgroundColor: selectedResponse.tag.color }}
                                  />
                                  {selectedResponse.tag.name}
                                </div>
                              ) : (
                                <div className="flex items-center">
                                  Select a label
                                </div>
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent 
                            align="start" 
                            className="w-[--trigger-width]"
                            onKeyDown={(e) => {
                              // Handle enter key to select the focused item
                              if (e.key === 'Enter') {
                                const focusedItem = document.querySelector('[data-radix-dropdown-item][data-highlighted]') as HTMLElement;
                                if (focusedItem) {
                                  focusedItem.click();
                                }
                              }
                            }}
                          >
                            {availableTags.map(tag => (
                              <DropdownMenuItem 
                                key={tag.id}
                                className={cn(
                                  "flex items-center cursor-pointer",
                                  selectedResponse.tag_id === tag.id ? "bg-accent" : ""
                                )}
                                onClick={() => {
                                  console.log(`Clicked tag: ${tag.name} (${tag.id})`);
                                  handleTagChange(selectedResponse.id, tag.name);
                                  setIsTagDropdownOpen(false); // Close the dropdown after selection
                                }}
                              >
                                <div 
                                  className="w-3 h-3 rounded-full mr-2" 
                                  style={{ backgroundColor: tag.color }}
                                />
                                <span className="truncate">{tag.name}</span>
                                {selectedResponse.tag_id === tag.id && (
                                  <Check className="h-4 w-4 ml-auto" />
                                )}
                              </DropdownMenuItem>
                            ))}
                            {selectedResponse.tag_id && (
                              <DropdownMenuItem 
                                className="flex items-center cursor-pointer border-t mt-1 pt-1"
                                onClick={() => {
                                  console.log("Clearing tag");
                                  handleTagChange(selectedResponse.id, null);
                                  setIsTagDropdownOpen(false); // Close the dropdown after selection
                                }}
                              >
                                Clear label
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      
                      {selectedResponse.image_url && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-muted-foreground">Image</p>
                          <div className="feedback-image-container" onClick={() => setShowImagePreview(true)}>
                            <FeedbackImage
                              imagePath={selectedResponse.image_url}
                              alt="Feedback screenshot"
                              className="feedback-image"
                            />
                          </div>
                          {selectedResponse.image_name && (
                            <p className="text-xs text-muted-foreground">{selectedResponse.image_name}</p>
                          )}
                        </div>
                      )}
                      
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-muted-foreground">User Information</p>
                          <div className="text-sm space-y-1">
                            <p>ID: <span className="break-all">{selectedResponse.user_id || '-'}</span></p>
                            <p>Email: <span className="break-all">{selectedResponse.user_email || '-'}</span></p>
                            <p>Name: <span className="break-all">{selectedResponse.user_name || '-'}</span></p>
                            <p>Page URL: <span className="break-all">{selectedResponse.url_path || '-'}</span></p>
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-muted-foreground">System Information</p>
                          <div className="text-sm space-y-1">
                            <p>OS: <span className="break-all">{selectedResponse.operating_system}</span></p>
                            <p>Device: <span className="break-all">{selectedResponse.screen_category}</span></p>
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-muted-foreground">Date</p>
                          <p className="text-sm">
                            {new Date(selectedResponse.created_at).toLocaleString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: 'numeric',
                              hour12: true
                            })}
                          </p>
                        </div>
                        
                        <div className="flex justify-start">
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => handleResponseDelete(selectedResponse.id)}
                          >
                            Delete Feedback
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="w-[70%] flex items-center justify-center border-l h-full overflow-hidden">
                <div className="text-center text-muted-foreground">
                  <h3 className="text-lg font-medium mb-2">No message selected</h3>
                  <p>Select a message from the inbox to view the conversation</p>
                </div>
              </div>
            )}
          </>
        )}
        
        {!loading && !selectedFormId && formsChecked && (
          <div className="container py-12 px-8 space-y-8 w-full">
            <div className="max-w-2xl mx-auto h-[calc(100vh-12rem)] flex items-center">
              <div className="text-center space-y-2 mb-4">
                <h1 className="text-3xl font-semibold welcome-title">Welcome to Userbird 🎉</h1>
                <p className="text-muted-foreground welcome-description">The easiest way to collect and manage user feedback for your product.</p>
                <div className="mt-12 py-8 pb-12">
                  <div className="grid grid-cols-3 gap-8">
                    <div className="flex flex-col items-center text-center gap-4 step-1">
                      <div className="flex-none flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-medium">1</div>
                      <h3 className="font-medium">Create a feedback form</h3>
                      <p className="text-sm text-muted-foreground">Set up a feedback form for your products in seconds.</p>
                    </div>
                    <div className="flex flex-col items-center text-center gap-4 step-2">
                      <div className="flex-none flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-medium">2</div>
                      <h3 className="font-medium">Add it to your product</h3>
                      <p className="text-sm text-muted-foreground">Install the form with a simple React code snippet.</p>
                    </div>
                    <div className="flex flex-col items-center text-center gap-4 step-3">
                      <div className="flex-none flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-medium">3</div>
                      <h3 className="font-medium">Start collecting feedback</h3>
                      <p className="text-sm text-muted-foreground">Get email notifications and get feedback right into your CRM.</p>
                    </div>
                  </div>
                </div>
                <div className="mt-12">
                  <Button onClick={() => setShowNewFormDialog(true)} size="lg" className="gap-2 create-button">
                    <Plus className="w-4 h-4" />
                    Create Your First Form
                  </Button>
                </div>
              </div>
              {/* Commented out form creator for now */}
              {/* <FormCreator /> */}
            </div>
          </div>
        )}
        <NewFormDialog
          open={showNewFormDialog}
          onOpenChange={setShowNewFormDialog}
          onFormSelect={setSelectedFormId}
        />
        {selectedFormId && (
          <InstallInstructionsModal
            formId={selectedFormId}
            open={showInstallModal || shouldShowInstructions}
            onOpenChange={(open) => {
              setShowInstallModal(open)
              setShouldShowInstructions(false)
            }}
          />
        )}
        {selectedFormId && (
          <FormSettingsDialog
            formId={selectedFormId}
            formUrl={formName}
            productName={productName}
            buttonColor={buttonColor}
            supportText={supportText}
            keyboardShortcut={keyboardShortcut}
            soundEnabled={soundEnabled}
            showGifOnSuccess={showGifOnSuccess}
            removeBranding={removeBranding}
            initialGifUrls={gifUrls}
            open={showSettingsDialog}
            onOpenChange={setShowSettingsDialog}
            onSettingsSaved={() => {
              // Refetch form data using the same approach that handles both owners and collaborators
              const refetchFormDetails = async () => {
                // First try to fetch as owner
                let { data, error } = await supabase
                  .from('forms')
                  .select('url, product_name, button_color, support_text, keyboard_shortcut, sound_enabled, show_gif_on_success, gif_urls, remove_branding')
                  .eq('id', selectedFormId)
                  .eq('owner_id', user?.id || '')
                  .single();

                // If no data found or error occurred, the user might be a collaborator
                if (!data || error) {
                  // Check if user has access to this form
                  const { data: hasAccess } = await supabase
                    .rpc('user_has_form_access', {
                      form_id_param: selectedFormId,
                      user_id_param: user?.id || ''
                    });

                  if (hasAccess) {
                    // User has collaborative access, fetch form details
                    const { data: formData, error: formError } = await supabase
                      .from('forms')
                      .select('url, product_name, button_color, support_text, keyboard_shortcut, sound_enabled, show_gif_on_success, gif_urls, remove_branding')
                      .eq('id', selectedFormId)
                      .single();

                    if (!formError && formData) {
                      data = formData;
                    }
                  }
                }

                if (data) {
                  setFormName(data.url);
                  setProductName(data.product_name);
                  setButtonColor(data.button_color);
                  setSupportText(data.support_text);
                  setKeyboardShortcut(data.keyboard_shortcut);
                  setSoundEnabled(data.sound_enabled);
                  setShowGifOnSuccess(data.show_gif_on_success);
                  setGifUrls(data.gif_urls || []);
                  setRemoveBranding(data.remove_branding);
                }
              };

              refetchFormDetails();
            }}
            onDelete={handleDelete}
          >
            <TagManager
              formId={selectedFormId}
              onTagsChange={() => {
                // Refresh tags
                const fetchTags = async () => {
                  if (!selectedFormId) return;
                  
                  const { data, error } = await supabase
                    .from('feedback_tags')
                    .select('*')
                    .eq('form_id', selectedFormId)
                    .order('name');

                  if (error) {
                    console.error('Error fetching tags:', error);
                  } else {
                    setAvailableTags(data || []);
                  }
                };
                
                fetchTags();
              }}
            />
          </FormSettingsDialog>
        )}
        {showDeleteConfirmation && (
          <Dialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
            <DialogContent className="max-w-md max-h-[90vh] overflow-auto">
              <DialogHeader>
                <DialogTitle>Confirm Deletion</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p>Are you sure you want to delete this feedback?</p>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowDeleteConfirmation(false)}>Cancel</Button>
                  <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
        
        {/* Image preview dialog */}
        {selectedResponse?.image_url && (
          <Dialog open={showImagePreview} onOpenChange={setShowImagePreview}>
            <DialogContent className="max-w-3xl max-h-[90vh] p-0 overflow-auto">
              <div className="p-6">
                <FeedbackImage
                  imagePath={selectedResponse.image_url}
                  alt="Feedback screenshot"
                  className="w-full h-auto"
                />
              </div>
            </DialogContent>
          </Dialog>
        )}
        
        {/* Tag Manager Dialog */}
        {selectedFormId && (
          <Dialog open={showTagManagerDialog} onOpenChange={setShowTagManagerDialog}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Tag Manager</DialogTitle>
              </DialogHeader>
              <TagManager 
                formId={selectedFormId}
                onTagsChange={() => {
                  // Refresh tags
                  const fetchTags = async () => {
                    if (!selectedFormId) return;
                    
                    const { data, error } = await supabase
                      .from('feedback_tags')
                      .select('*')
                      .eq('form_id', selectedFormId)
                      .order('name');
                    
                    if (error) {
                      console.error('Error fetching tags:', error);
                    } else {
                      setAvailableTags(data || []);
                    }
                  };
                  
                  fetchTags();
                }}
              />
            </DialogContent>
          </Dialog>
        )}
        
        {/* Batch action bar for multiple selections */}
        {selectedBatchIds.length > 0 && (
          <BatchActionBar
            selectedIds={selectedBatchIds}
            onClearSelection={() => setSelectedBatchIds([])}
            onStatusChange={handleBatchStatusChange}
            onTagChange={handleBatchTagChange}
            availableTags={availableTags}
          />
        )}
      </main>
    </div>
  )
}