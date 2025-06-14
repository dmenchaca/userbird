import { useState, useCallback, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, Settings2, Loader, Inbox, CheckCircle, Circle, Check, ChevronDown, Star, Tag, MoreHorizontal, UserCircle, ChevronsUpDown, Search, ArrowUp, ArrowDown, PanelRight, Code, ZoomIn, ZoomOut, Download, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { FormSettingsDialog } from '@/components/form-settings-dialog'
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
import { useWorkspaceSetupCheck } from '@/lib/hooks/useWorkspaceSetupCheck'
import { WorkspaceCreatorDialog } from '@/components/workspace-creator-dialog'
import { updateFeedbackTag } from '@/lib/services/feedback-tags'
import { colorOptions } from '@/lib/utils/colors'
import { useTheme } from "next-themes"

interface DashboardProps {
  initialFormId?: string
  initialTicketNumber?: string
}

export function Dashboard({ initialFormId, initialTicketNumber }: DashboardProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { needsSetupWizard } = useWorkspaceSetupCheck()
  const [selectedFormId, setSelectedFormId] = useState<string | undefined>(initialFormId)
  const [formName, setFormName] = useState<string>('')
  const [productName, setProductName] = useState<string | null>(null)
  const [buttonColor, setButtonColor] = useState('#1f2937')
  const [supportText, setSupportText] = useState<string | null>(null)
  const [keyboardShortcut, setKeyboardShortcut] = useState<string | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [showGifOnSuccess, setShowGifOnSuccess] = useState(false)
  const [removeBranding, setRemoveBranding] = useState(false)
  const [collectConsoleLogs, setCollectConsoleLogs] = useState(false)
  const [screenshotMethod, setScreenshotMethod] = useState('canvas')
  const [gifUrls, setGifUrls] = useState<string[]>([])
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [showNewFormDialog, setShowNewFormDialog] = useState(false)
  const [loading, setLoading] = useState(true) // Always start with loading true
  const [formsChecked, setFormsChecked] = useState(false) // Track whether we've checked for forms
  const showFeedbackHint = !selectedFormId
  const [feedbackCounts, setFeedbackCounts] = useState({ open: 0, closed: 0 })
  const [activeFilter, setActiveFilter] = useState<'all' | 'open' | 'closed' | { type: 'tag', id: string, name: string }>('open')
  const [selectedResponse, setSelectedResponse] = useState<FeedbackResponse | null>(null)
  const [showImagePreview, setShowImagePreview] = useState(false)
  const [imageZoom, setImageZoom] = useState(100)
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
  // New state for tracking widget callout dismissal
  const [widgetCalloutDismissed, setWidgetCalloutDismissed] = useState(false)
  const { theme } = useTheme()
  const isDarkMode = theme === "dark"
  
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
  const [isShowingDetails, setIsShowingDetails] = useState(() => {
    // Load the panel state from localStorage, default to false (closed)
    const savedState = localStorage.getItem('usermonk-details-panel-open')
    return savedState === 'true'
  })
  
  // Use a ref to track if we've already processed URL params to prevent multiple timing issues
  const urlParamsProcessedRef = useRef(false)
  
  // Add a new state variable for the settings tab
  const [settingsActiveTab, setSettingsActiveTab] = useState<'workspace' | 'widget' | 'notifications' | 'webhooks' | 'tags' | 'delete' | 'emails' | 'collaborators' | 'ai-automation' | 'integrations'>('workspace')
  
  // Add debug listener for settingsActiveTab changes
  useEffect(() => {
    console.log('settingsActiveTab changed to:', settingsActiveTab);
  }, [settingsActiveTab]);
  
  // Reset URL params processed flag when dialog closes
  useEffect(() => {
    if (!showSettingsDialog) {
      // Reset the URL params processing flag when dialog closes
      // This ensures next time dialog opens with URL params, they'll be processed
      urlParamsProcessedRef.current = false;
      console.log('Reset urlParamsProcessedRef because dialog closed');
    }
  }, [showSettingsDialog]);
  
  // Add an effect to read URL parameters for dialog control
  useEffect(() => {
    if (!selectedFormId) return;
    
    // Check if we've already processed the URL params for this form
    if (urlParamsProcessedRef.current) return;
    
    const params = new URLSearchParams(window.location.search);
    const settingsParam = params.get('settings');
    
    console.log('URL settings parameter detected:', settingsParam);
    
    if (settingsParam) {
      // Mark that we've processed URL params
      urlParamsProcessedRef.current = true;
      
      // Valid tabs that can be specified in the URL
      const validTabs = ['workspace', 'widget', 'notifications', 'webhooks', 'tags', 'delete', 'emails', 'collaborators', 'ai-automation', 'integrations', 'slack'];
      
      // Set the active tab if valid, otherwise default to 'workspace'
      if (validTabs.includes(settingsParam)) {
        // Map 'slack' to 'integrations' since that's the actual tab name
        const mappedTab = settingsParam === 'slack' ? 'integrations' : settingsParam;
        console.log('Setting active tab to:', mappedTab);
        
        // Set the tab state first
        setSettingsActiveTab(mappedTab as any);
        
        // Open the dialog with a clearly defined sequence and increased timeout
        setTimeout(() => {
          console.log('Opening settings dialog with tab:', mappedTab);
          setShowSettingsDialog(true);
        }, 150); // Increased timeout for more reliability
      } else {
        setShowSettingsDialog(true);
      }
    }
  }, [selectedFormId, window.location.search]);
  
  // Update URL when settings dialog is opened/closed or tab is changed
  useEffect(() => {
    if (!selectedFormId) return;
    
    const url = new URL(window.location.href);
    
    if (showSettingsDialog) {
      // Always map 'integrations' tab to 'slack' in the URL for better UX
      const urlParam = settingsActiveTab === 'integrations' ? 'slack' : settingsActiveTab;
      url.searchParams.set('settings', urlParam);
    } else {
      url.searchParams.delete('settings');
    }
    
    // Replace the current URL without adding a new history entry
    window.history.replaceState({}, '', url.toString());
  }, [showSettingsDialog, settingsActiveTab, selectedFormId]);
  
  // Handle settings tab change
  const handleSettingsTabChange = (tab: typeof settingsActiveTab) => {
    console.log('Tab change requested via component callback:', tab);
    setSettingsActiveTab(tab);
  };

  // Image zoom functions
  const handleZoomIn = () => {
    setImageZoom(prev => Math.min(prev + 25, 300));
  };

  const handleZoomOut = () => {
    setImageZoom(prev => Math.max(prev - 25, 25));
  };

  const handleImageClick = () => {
    setImageZoom(prev => prev === 100 ? 150 : 100);
  };

  const handleDownload = () => {
    if (selectedResponse?.image_url) {
      const link = document.createElement('a');
      link.href = selectedResponse.image_url;
      link.download = `feedback-attachment-${selectedResponse.id}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };
  
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
  
  // Save the selected form ID to localStorage whenever it changes
  useEffect(() => {
    if (selectedFormId && user?.id) {
      localStorage.setItem(`usermonk-last-form-${user.id}`, selectedFormId);
    }
  }, [selectedFormId, user?.id]);

  // Handle form selection
  const handleFormSelect = (formId: string) => {
    setSelectedFormId(formId);
    navigate(`/forms/${formId}`);
  };
  
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
        // First check if we have a saved form ID in localStorage
        const savedFormId = localStorage.getItem(`usermonk-last-form-${user.id}`);
        
        if (savedFormId) {
          // Verify user still has access to this form
          const { data: hasAccess } = await supabase
            .rpc('user_has_form_access', {
              form_id_param: savedFormId,
              user_id_param: user.id
            });
            
          if (hasAccess) {
            setSelectedFormId(savedFormId);
            setFormsChecked(true);
            setLoading(false);
            return;
          }
          // If user no longer has access, remove from localStorage and continue with default behavior
          localStorage.removeItem(`usermonk-last-form-${user.id}`);
        }
        
        // Default behavior - get most recent form
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
            setSelectedFormId(collabData[0] as string);
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
  }, [user?.id, initialFormId, navigate]);
  
  // Check if we should show instructions for this form
  useEffect(() => {
    if (selectedFormId) {
      // Auto-show feature removed
      // Just set a flag that these instructions were shown,
      // without actually showing instructions automatically
      const key = `instructions-shown-${selectedFormId}`;
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, 'true');
      }
    }
  }, [selectedFormId])

  // Fetch form name when form is selected
  useEffect(() => {
    if (selectedFormId && user?.id) {
      const fetchFormDetails = async () => {
        // First try to fetch as owner
        let { data, error } = await supabase
          .from('forms')
          .select('url, product_name, button_color, support_text, keyboard_shortcut, sound_enabled, show_gif_on_success, gif_urls, remove_branding, collect_console_logs, screenshot_method')
          .eq('id', selectedFormId)
          .eq('owner_id', user.id || '')
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
              .select('url, product_name, button_color, support_text, keyboard_shortcut, sound_enabled, show_gif_on_success, gif_urls, remove_branding, collect_console_logs, screenshot_method')
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
          setCollectConsoleLogs(data.collect_console_logs ?? false);
          setScreenshotMethod(data.screenshot_method || 'canvas');
        }
      };

      fetchFormDetails();
    }
  }, [selectedFormId, user?.id]);

  // Update URL when form selection changes
  useEffect(() => {
    console.log('URL update effect running:', { 
      selectedFormId, 
      hasSelectedResponse: !!selectedResponse, 
      responseDetails: selectedResponse ? {
        id: selectedResponse.id,
        ticketNumber: selectedResponse.ticket_number
      } : null,
      initialTicketNumber
    });
    
    // Check if we're currently navigating to a new form from the form creator
    const navigatingToNewForm = localStorage.getItem('usermonk-navigating-to-new-form');
    const currentFormId = window.location.pathname.split('/').filter(Boolean)[1];
    
    // If we're navigating to a new form and it matches the current URL, skip redirection
    if (navigatingToNewForm && currentFormId === navigatingToNewForm) {
      console.log('Detected navigation to newly created form, skipping redirect');
      
      // Update selected form ID to match the new form
      if (selectedFormId !== navigatingToNewForm) {
        setSelectedFormId(navigatingToNewForm);
      }
      return;
    }
    
    // Don't update URL if we're still potentially loading a ticket from initialTicketNumber
    // This prevents the redirect race condition
    if (initialTicketNumber && !selectedResponse) {
      console.log('Initial ticket number present but no selected response yet - waiting for ticket fetch to complete');
      return;
    }
    
    if (selectedFormId) {
      // Only update URL if there's no selected response (with ticket number)
      // This prevents overwriting the URL with ticket number
      if (!selectedResponse) {
        console.log('No selected response, redirecting to form URL');
        navigate(`/forms/${selectedFormId}`, { replace: true });
      } else {
        console.log('Response selected, URL should remain at ticket URL');
      }
    } else if (formsChecked && !loading) {
      navigate('/', { replace: true });
    }
  }, [selectedFormId, navigate, loading, formsChecked, selectedResponse, initialTicketNumber]);

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

  function clearOnboardingState(userId: string) {
    localStorage.removeItem(`usermonk-onboarding-step-${userId}`);
    localStorage.removeItem(`usermonk-onboarding-completed-${userId}`);
    localStorage.removeItem(`usermonk-last-form-${userId}`);
  }

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
        // Also check for collaborator forms
        const { data: collabData, error: collabError } = await supabase
          .rpc('get_user_collaboration_forms', { user_id_param: user?.id });
        if (!collabError && collabData && Array.isArray(collabData) && collabData.length > 0) {
          setSelectedFormId(collabData[0] as string);
        } else {
          setSelectedFormId(undefined);
          if (user?.id) clearOnboardingState(user.id);
        }
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

  // Get random tag color for new tags
  const getRandomTagColor = () => {
    const randomIndex = Math.floor(Math.random() * colorOptions.length);
    return colorOptions[randomIndex].value;
  };

  // Handle batch tag change
  const handleBatchTagChange = async (ids: string[], tagId: string | null) => {
    if (!ids.length) return;
    
    try {
      // Process each feedback item individually to create tag change events
      const results = await Promise.all(
        ids.map(async (feedbackId) => {
          return updateFeedbackTag(
            feedbackId,
            tagId,
            user?.id || '',
            { source: 'dashboard', batch: true }
          );
        })
      );
      
      // Check if all operations were successful
      const allSuccessful = results.every(result => result === true);
      
      if (!allSuccessful) {
        console.warn('Some tag updates failed in batch operation');
      }
      
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
      
      // Use the service function to update the tag and create a tag change event
      const success = await updateFeedbackTag(
        id, 
        tagId,
        user?.id || '',
        { source: 'dashboard' }
      );
      
      if (!success) {
        throw new Error('Failed to update tag');
      }
      
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
          (event.ctrlKey || event.metaKey) && (event.key === 'r' || event.key === 'j' || event.key === 'J') ||
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

  // Reset image zoom when response changes
  useEffect(() => {
    setImageZoom(100);
  }, [selectedResponse?.id]);

  // Handle URL navigation when selecting a response
  const handleResponseSelect = (response: FeedbackResponse | null) => {
    console.log('handleResponseSelect called with:', response ? { 
      id: response.id, 
      ticketNumber: response.ticket_number 
    } : 'null response');
    
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
    
    console.log('Setting selectedResponse to:', updatedResponse ? {
      id: updatedResponse.id,
      ticketNumber: updatedResponse.ticket_number
    } : 'null');
    
    setSelectedResponse(updatedResponse);
    
    // Update URL to include ticket number if a response is selected
    if (updatedResponse && selectedFormId) {
      console.log('Navigating to ticket URL:', `/forms/${selectedFormId}/ticket/${updatedResponse.ticket_number}`);
      navigate(`/forms/${selectedFormId}/ticket/${updatedResponse.ticket_number}`, { replace: true });
    } else if (selectedFormId) {
      // If no response selected, just show form URL
      console.log('No response selected, navigating to form URL:', `/forms/${selectedFormId}`);
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
    
    console.log('Fetching ticket:', { selectedFormId, initialTicketNumber, ticketType: typeof initialTicketNumber });

    const fetchTicket = async () => {
      try {
        // Find feedback with matching ticket number
        console.log('Making Supabase query for ticket:', { formId: selectedFormId, ticketNumber: initialTicketNumber });
        
        const { data, error } = await supabase
          .from('feedback')
          .select('*')
          .eq('form_id', selectedFormId)
          .eq('ticket_number', initialTicketNumber)
          .limit(1);
          
        console.log('Ticket query response:', { data, error, found: data && data.length > 0 });

        if (error) throw error;

        if (data && data.length > 0) {
          let responseData = data[0];
          
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
          console.log('Setting selected response:', responseData);
          setSelectedResponse(responseData);
          
          // After the data is loaded, we need to make sure the inbox also has this ticket
          // First refresh the inbox to ensure it has the most current data
          if (inboxRef.current) {
            // Wait for the inbox to refresh and load the tickets
            await inboxRef.current.refreshData(true);
            
            // Then set the active response in the inbox to highlight it
            // This is crucial for showing the selected ticket in the UI
            console.log('Setting active response in inbox:', responseData.id);
            inboxRef.current.setActiveResponse(responseData.id);
          }
        } else {
          console.log('No ticket found with number:', initialTicketNumber);
        }
      } catch (error) {
        console.error('Error fetching ticket:', error);
      }
    };

    fetchTicket();
  }, [selectedFormId, initialTicketNumber, collaborators]);

  // Log the result of the workspace setup check when it changes
  useEffect(() => {
    if (needsSetupWizard !== null) {
      console.log('Workspace setup wizard needed:', needsSetupWizard)
    }
  }, [needsSetupWizard])

  // Early redirect for workspace setup
  useEffect(() => {
    if (needsSetupWizard) {
      navigate('/setup-workspace', { replace: true })
    }
  }, [needsSetupWizard, navigate])

  // Load widget callout dismissal state from localStorage on initial load
  useEffect(() => {
    if (user?.id && selectedFormId) {
      const key = `widget-callout-dismissed-${user.id}-${selectedFormId}`;
      const isDismissed = localStorage.getItem(key) === 'true';
      setWidgetCalloutDismissed(isDismissed);
    }
  }, [user?.id, selectedFormId]);

  // Function to dismiss the widget callout
  const dismissWidgetCallout = useCallback(() => {
    if (user?.id && selectedFormId) {
      const key = `widget-callout-dismissed-${user.id}-${selectedFormId}`;
      localStorage.setItem(key, 'true');
      setWidgetCalloutDismissed(true);
    }
  }, [user?.id, selectedFormId]);

  // Optional early return to delay rendering until the check is ready
  if (needsSetupWizard === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Helper function to get color styles based on theme
  const getColorStyle = (colorValue: string) => {
    const colorOption = colorOptions.find(c => 
      isDarkMode ? c.dark.value === colorValue : c.value === colorValue
    );
    
    if (isDarkMode && colorOption) {
      return {
        backgroundColor: colorOption.dark.value, // Changed from text to value
        borderColor: `${colorOption.dark.value}70`
      };
    }
    
    return {
      backgroundColor: colorValue, // Changed from text to value
      borderColor: `${colorValue}70`
    };
  };

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="fixed left-0 w-[240px] h-screen border-r bg-muted/50 flex flex-col">
        <div className="flex flex-col h-full">
          <FormsDropdown 
            selectedFormId={selectedFormId}
            onFormSelect={handleFormSelect}
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
                                      style={getColorStyle(quickTagColor)}
                                    />
                                    <span className="ml-2 text-sm text-foreground">
                                      {colorOptions.find(c => isDarkMode ? c.dark.value === quickTagColor : c.value === quickTagColor)?.name || 'Select color'}
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
                                        style={getColorStyle(color.value)}
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
                              className="rounded border-border text-primary focus:ring-primary"
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
                            color: isDarkMode && colorOptions.find(c => c.value === tag.color)?.dark?.value ? 
                              colorOptions.find(c => c.value === tag.color)?.dark.value : tag.color,
                            fill: isDarkMode ? 
                              `${colorOptions.find(c => c.value === tag.color)?.dark?.background || `${tag.color}30`}` :
                              `${tag.color}30`,
                            stroke: isDarkMode && colorOptions.find(c => c.value === tag.color)?.dark?.value ? 
                              colorOptions.find(c => c.value === tag.color)?.dark.value : tag.color
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
                                        style={getColorStyle(editTagColor)}
                                      />
                                      <span className="ml-2 text-sm text-foreground">
                                        {colorOptions.find(c => isDarkMode ? c.dark.value === editTagColor : c.value === editTagColor)?.name || 'Select color'}
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
                                          style={getColorStyle(color.value)}
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
                                className="rounded border-border text-primary focus:ring-primary"
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
              {/* Callout Card for Widget Installation */}
              {!widgetCalloutDismissed && (
                <div className="bg-card/40 dark:bg-slate-800/60 border rounded-lg p-3 mb-3 relative shadow-md">
                  <button 
                    className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
                    onClick={dismissWidgetCallout}
                    aria-label="Dismiss"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x">
                      <path d="M18 6 6 18"></path>
                      <path d="m6 6 12 12"></path>
                    </svg>
                  </button>
                  <h4 className="text-sm font-medium mb-1">Pro tip 🔥</h4>
                  <p className="text-xs text-muted-foreground" style={{ marginBottom: "12px" }}>Install the feedback widget and get more user feedback. It's super easy.</p>
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      console.log('Widget setup button clicked');
                      
                      // Since we're manually handling the dialog opening,
                      // reset the URL params processing flag
                      urlParamsProcessedRef.current = false;
                      
                      // First explicitly set the active tab in state
                      setSettingsActiveTab('widget');
                      console.log('Set settingsActiveTab to "widget"');
                      
                      // Update URL with settings=widget parameter
                      const url = new URL(window.location.href);
                      url.searchParams.set('settings', 'widget');
                      window.history.pushState({}, '', url.toString());
                      console.log('Updated URL with widget parameter');
                      
                      // Open settings dialog with widget tab active after a brief timeout
                      // to ensure the tab change has been applied
                      setTimeout(() => {
                        console.log('Now opening settings dialog');
                        setShowSettingsDialog(true);
                      }, 150);
                    }}
                  >
                    <Code className="mr-2 h-4 w-4" />
                    Install Widget
                  </Button>
                </div>
              )}

              <Button
                variant="ghost"
                className="inline-flex items-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 h-8 rounded-md px-3 justify-start w-full"
                onClick={() => setShowSettingsDialog(true)}
              >
                <Settings2 className="mr-2 h-4 w-4" />
                Settings
              </Button>
              
              {/* Removed Install Instructions button that appeared when !hasResponses */}
              
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
                  />
                </div>
              </div>
            </div>
            
            {selectedResponse ? (
              <>
                <div className="flex-1 conversation-wrapper border-l border-border min-w-0 overflow-hidden h-full flex flex-col">
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
                          <DropdownMenu open={isTagDropdownOpen} onOpenChange={handleTagDropdownOpenChange}>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                ref={tagDropdownTriggerRef}
                                variant="outline" 
                                size="sm"
                                className={cn(
                                  selectedResponse.tag ? "justify-between" : ""
                                )}
                              >
                                <div className="flex items-center">
                                  {selectedResponse.tag ? (
                                    <>
                                      <div 
                                        className="w-3 h-3 rounded-full mr-2" 
                                        style={selectedResponse.tag ? getColorStyle(selectedResponse.tag.color) : {}}
                                      />
                                      {selectedResponse.tag.name}
                                    </>
                                  ) : (
                                    <>
                                      <Tag className="h-4 w-4 mr-2 text-muted-foreground" />
                                      Label
                                    </>
                                  )}
                                </div>
                                <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground mr-1">
                                  L
                                </span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent 
                              align="end" 
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
                                    style={getColorStyle(tag.color)}
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

                          <DropdownMenu open={isStatusDropdownOpen} onOpenChange={handleStatusDropdownOpenChange}>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                ref={statusDropdownTriggerRef}
                                variant={selectedResponse.status === 'open' ? "outline" : "secondary"} 
                                size="sm"
                                className="justify-between"
                              >
                                <div className="flex items-center">
                                  {selectedResponse.status === 'open' ? (
                                    <Circle className="h-3 w-3 mr-2" />
                                  ) : (
                                    <Check className="h-4 w-4 mr-2" />
                                  )}
                                  {selectedResponse.status === 'open' ? 'Open' : 'Closed'}
                                </div>
                                <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground mr-1">
                                  O
                                </span>
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
                                <Circle className="h-3 w-3 mr-2 text-primary" />
                                <span>Open</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="flex items-center cursor-pointer"
                                onClick={() => handleResponseStatusChange(selectedResponse.id, 'closed')}
                              >
                                <Check className="h-4 w-4 mr-2 text-primary" />
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
                                className="justify-between"
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
                                        <UserCircle className="h-4 w-4 mr-2" />
                                      )}
                                      {selectedResponse.assignee.user_name || selectedResponse.assignee.email.split('@')[0]}
                                    </>
                                  ) : (
                                    <>
                                      <UserCircle className="h-4 w-4 mr-2" />
                                      Assign
                                    </>
                                  )}
                                </div>
                                <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground mr-1">
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
                                            <UserCircle className="h-4 w-4 mr-2" />
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

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-muted-foreground border-border bg-muted/50 hover:bg-muted"
                                  onClick={() => {
                                    const newState = !isShowingDetails
                                    setIsShowingDetails(newState)
                                    // Save the panel state to localStorage
                                    localStorage.setItem('usermonk-details-panel-open', String(newState))
                                  }}
                                >
                                  <PanelRight className={cn(
                                    "h-4 w-4",
                                    isShowingDetails ? "text-slate-600" : "text-slate-400"
                                  )} />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                {isShowingDetails ? "Hide details" : "Show details"}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    </div>
                  </header>
                  <div className="container px-0 flex-1 h-[calc(100vh-65px)] overflow-hidden">
                    <div className="flex h-full relative">
                      <div className={cn(
                        "flex-1 min-w-0 overflow-hidden transition-all duration-300 ease-in-out",
                        isShowingDetails ? "pr-[260px]" : ""
                      )}>
                        <ConversationThread 
                          ref={conversationThreadRef}
                          response={selectedResponse} 
                          onStatusChange={handleResponseStatusChange}
                          collaborators={collaborators}
                          availableTags={availableTags}
                        />
                      </div>
                      
                      <div 
                        className={cn(
                          "absolute right-0 top-0 w-[260px] border-l overflow-hidden h-full transition-transform duration-300 ease-in-out",
                          isShowingDetails ? "translate-x-0" : "translate-x-full"
                        )}
                      >
                        <div className="w-full h-full flex flex-col">
                          <header className="border-b border-border">
                            <div className="container py-2 px-4">
                              <div className="flex items-center justify-between">
                                <h2 className="text-base truncate">Details</h2>
                              </div>
                            </div>
                          </header>
                          <div className="container p-4 overflow-y-auto overflow-x-hidden h-[calc(100vh-65px)] flex-1">
                            <div className="space-y-6 break-words">
                              {/* Label section - Removed and moved to top bar */}
                              
                              {selectedResponse.image_url && (
                                <div className="space-y-2">
                                  <p className="text-sm font-medium text-muted-foreground">Image</p>
                                  <div className="feedback-image-container" onClick={() => setShowImagePreview(true)}>
                                    <FeedbackImage
                                      imagePath={selectedResponse.image_url}
                                      alt="Feedback screenshot"
                                      className="feedback-image max-w-full"
                                    />
                                  </div>
                                  {selectedResponse.image_name && (
                                    <p className="text-xs text-muted-foreground truncate">{selectedResponse.image_name}</p>
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
        <WorkspaceCreatorDialog
          open={showNewFormDialog}
          onClose={() => setShowNewFormDialog(false)}
        />
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
            collectConsoleLogs={collectConsoleLogs}
            screenshotMethod={screenshotMethod}
            initialGifUrls={gifUrls}
            initialTab={settingsActiveTab}
            open={showSettingsDialog}
            onOpenChange={setShowSettingsDialog}
            onTabChange={handleSettingsTabChange}
            onSettingsSaved={() => {
              // Refetch form data using the same approach that handles both owners and collaborators
              const refetchFormDetails = async () => {
                // First try to fetch as owner
                let { data, error } = await supabase
                  .from('forms')
                  .select('url, product_name, button_color, support_text, keyboard_shortcut, sound_enabled, show_gif_on_success, gif_urls, remove_branding, collect_console_logs, screenshot_method')
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
                      .select('url, product_name, button_color, support_text, keyboard_shortcut, sound_enabled, show_gif_on_success, gif_urls, remove_branding, collect_console_logs, screenshot_method')
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
                  setCollectConsoleLogs(data.collect_console_logs ?? false);
                  setScreenshotMethod(data.screenshot_method || 'canvas');
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
          <Dialog open={showImagePreview} onOpenChange={(open) => {
            setShowImagePreview(open);
            if (!open) setImageZoom(100); // Reset zoom when closing
          }}>
            <DialogContent className="max-w-[90vw] max-h-[90vh] w-full h-full p-0 overflow-hidden focus:outline-none focus:ring-0" onOpenAutoFocus={(e) => e.preventDefault()} onCloseAutoFocus={(e) => e.preventDefault()}>
              <div className="relative flex flex-col h-full">
                {/* Image container */}
                <div className="flex-1 overflow-auto bg-black/5 dark:bg-black/20">
                  <div 
                    className="p-4"
                    style={{ 
                      width: `${Math.max(100, imageZoom)}%`,
                      height: `${Math.max(100, imageZoom)}%`,
                      minWidth: '100%',
                      minHeight: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <div 
                      className={`transition-transform duration-200 ease-in-out select-none ${
                        imageZoom === 100 ? 'cursor-zoom-in' : 'cursor-zoom-out'
                      }`}
                      style={{
                        transform: `scale(${imageZoom / 100})`,
                        transformOrigin: 'center center'
                      }}
                      onClick={handleImageClick}
                    >
                      <FeedbackImage
                        key={selectedResponse.image_url} // Add key to prevent unnecessary re-renders
                        imagePath={selectedResponse.image_url}
                        alt="Feedback screenshot"
                        className="max-h-[80vh] max-w-[80vw] object-contain cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Bottom controls - Notion style */}
                <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-10">
                  <TooltipProvider disableHoverableContent>
                    <div className="flex items-center gap-1 bg-background/90 backdrop-blur-sm border border-border rounded-lg px-2 py-1.5 shadow-lg">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={handleZoomOut}
                            variant="ghost"
                            size="sm"
                            disabled={imageZoom <= 25}
                            className="h-7 w-7 p-0 hover:bg-muted"
                          >
                            <ZoomOut className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          Zoom out
                        </TooltipContent>
                      </Tooltip>
                      <span className="text-xs font-medium min-w-[45px] text-center px-2 text-muted-foreground">
                        {imageZoom}%
                      </span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={handleZoomIn}
                            variant="ghost"
                            size="sm"
                            disabled={imageZoom >= 300}
                            className="h-7 w-7 p-0 hover:bg-muted"
                          >
                            <ZoomIn className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          Zoom in
                        </TooltipContent>
                      </Tooltip>
                      <div className="w-px h-4 bg-border mx-1" />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={handleDownload}
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 hover:bg-muted"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          Download image
                        </TooltipContent>
                      </Tooltip>
                      <div className="w-px h-4 bg-border mx-1" />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={() => setShowImagePreview(false)}
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 hover:bg-muted"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          Close
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TooltipProvider>
                </div>
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