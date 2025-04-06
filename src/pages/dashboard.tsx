import { useState, useCallback, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Plus, Code2, Settings2, Loader, Inbox, CheckCircle, Circle, Check, ChevronDown, Star } from 'lucide-react'
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
import { ConversationThread } from '@/components/conversation-thread'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { BatchActionBar } from '@/components/batch-action-bar'
import { TagManager } from '@/components/tag-manager'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface DashboardProps {
  initialFormId?: string
}

export function Dashboard({ initialFormId }: DashboardProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [selectedFormId, setSelectedFormId] = useState<string | undefined>(initialFormId)
  const [formName, setFormName] = useState<string>('')
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
  const [loading, setLoading] = useState(!initialFormId)
  const [hasAnyForms, setHasAnyForms] = useState(false)
  const [shouldShowInstructions, setShouldShowInstructions] = useState<boolean>(false)
  const showFeedbackHint = !selectedFormId
  const [feedbackCounts, setFeedbackCounts] = useState({ open: 0, closed: 0 })
  const [activeFilter, setActiveFilter] = useState<'all' | 'open' | 'closed' | { type: 'tag', id: string, name: string }>('open')
  const [selectedResponse, setSelectedResponse] = useState<FeedbackResponse | null>(null)
  const [showImagePreview, setShowImagePreview] = useState(false)
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([])
  const inboxRef = useRef<FeedbackInboxRef>(null)
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
  
  // Color palette inspired by Notion
  const colorOptions = [
    { name: 'Gray', value: '#64748B' },    // Slate
    { name: 'Brown', value: '#78716C' },   // Stone
    { name: 'Orange', value: '#F97316' },  // Orange
    { name: 'Yellow', value: '#EAB308' },  // Yellow
    { name: 'Green', value: '#10B981' },   // Emerald
    { name: 'Blue', value: '#3B82F6' },    // Blue
    { name: 'Purple', value: '#8B5CF6' },  // Violet
    { name: 'Pink', value: '#EC4899' },    // Pink
    { name: 'Red', value: '#EF4444' },     // Red
  ]
  
  // Fetch latest form if no form is selected
  useEffect(() => {
    if (!user?.id) return;
    
    // If initialFormId is provided, we don't need to fetch the latest form
    if (initialFormId) {
      setLoading(false);
      return;
    }
    
    const fetchLatestForm = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('forms')
          .select('id')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          setHasAnyForms(true);
          setSelectedFormId(data[0].id);
        } else {
          setHasAnyForms(false);
        }
      } catch (error) {
        console.error('Error fetching latest form:', error);
      } finally {
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
      supabase
        .from('forms')
        .select('url, button_color, support_text, keyboard_shortcut, sound_enabled, show_gif_on_success, gif_urls, remove_branding')
        .eq('id', selectedFormId)
        .eq('owner_id', user?.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setFormName(data.url)
            setButtonColor(data.button_color)
            setSupportText(data.support_text)
            setKeyboardShortcut(data.keyboard_shortcut)
            setSoundEnabled(data.sound_enabled)
            setShowGifOnSuccess(data.show_gif_on_success)
            setGifUrls(data.gif_urls || [])
            setRemoveBranding(data.remove_branding)
          }
        })
    }
  }, [selectedFormId, user?.id])

  // Update URL when form selection changes
  useEffect(() => {
    if (selectedFormId) {
      navigate(`/forms/${selectedFormId}`, { replace: true })
    } else if (!loading) {
      navigate('/', { replace: true })
    }
  }, [selectedFormId, navigate, loading, hasAnyForms])

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
        setHasAnyForms(false);
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
      
      // Refresh the inbox data directly using the ref
      if (inboxRef.current) {
        await inboxRef.current.refreshData();
      }
    } catch (error) {
      console.error('Error batch updating status:', error);
    }
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
      
      // Refresh the inbox data directly using the ref
      if (inboxRef.current) {
        await inboxRef.current.refreshData();
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
      
      // Refresh the inbox data directly
      if (inboxRef.current) {
        await inboxRef.current.refreshData();
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleResponseDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('feedback')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      // Clear the selected response if it was deleted
      if (selectedResponse && selectedResponse.id === id) {
        setSelectedResponse(null);
      }
    } catch (error) {
      console.error('Error deleting response:', error);
    }
  };

  const handleDownload = useCallback(() => {
    if (!selectedResponse?.image_url) return;
    const link = document.createElement('a');
    link.href = selectedResponse.image_url;
    link.download = selectedResponse.image_name || 'feedback-image';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [selectedResponse]);

  const handleTagChange = async (id: string, tagName: string | null) => {
    try {
      let tagId = null;
      
      // If tagName is provided, find the corresponding tag_id
      if (tagName) {
        console.log(`Finding tag with name: ${tagName}`);
        const { data: tagData, error: tagError } = await supabase
          .from('feedback_tags')
          .select('*') // Get all tag data, not just the ID
          .eq('name', tagName)
          .eq('form_id', selectedFormId) // Make sure we get the right form's tag
          .single();
          
        if (tagError) {
          console.error('Error fetching tag by name:', tagError);
          throw tagError;
        }
        
        if (!tagData) {
          console.error(`No tag found with name: ${tagName}`);
          toast.error(`Tag "${tagName}" not found`);
          return;
        }
        
        console.log('Found tag:', tagData);
        tagId = tagData.id;
      } else {
        console.log('Clearing tag (null)');
      }
      
      console.log(`Updating feedback ${id} with tag_id: ${tagId}`);
      
      // Update the feedback with the tag_id
      const { error } = await supabase
        .from('feedback')
        .update({ tag_id: tagId })
        .eq('id', id);

      if (error) {
        console.error('Error updating feedback with tag:', error);
        throw error;
      }
      
      console.log('Successfully updated feedback with tag');
      
      // Refresh the inbox data
      if (inboxRef.current) {
        await inboxRef.current.refreshData();
      }
      
      // If the updated response is currently selected, update it directly in state
      if (selectedResponse && selectedResponse.id === id) {
        if (tagName && tagId) {
          // Find the tag in our availableTags
          const matchingTag = availableTags.find(tag => tag.id === tagId);
          
          if (matchingTag) {
            console.log('Updating selected response with tag:', matchingTag);
            setSelectedResponse({
              ...selectedResponse,
              tag_id: tagId,
              tag: matchingTag
            });
          } else {
            // If we couldn't find the tag in availableTags, fetch it directly
            console.log('Fetching updated response data');
            const { data: updatedResponse, error: fetchError } = await supabase
              .from('feedback')
              .select(`
                *,
                tag:feedback_tags(*)
              `)
              .eq('id', id)
              .single();
              
            if (fetchError) {
              console.error('Error fetching updated response:', fetchError);
              throw fetchError;
            }
            
            // Update the selected response with the latest data
            if (updatedResponse) {
              console.log('Setting updated response:', updatedResponse);
              setSelectedResponse({
                ...updatedResponse,
                tag: updatedResponse.tag as any
              });
            }
          }
        } else {
          // If clearing the tag, just update the selected response directly
          console.log('Clearing tag from selected response');
          setSelectedResponse({
            ...selectedResponse,
            tag_id: null,
            tag: null
          });
        }
      }
      
      // Clear any batch selections
      setSelectedBatchIds([]);
      
    } catch (error) {
      console.error('Error updating tag:', error);
      toast.error("Failed to update tag");
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
  }, [selectedFormId]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only trigger shortcuts when a response is selected and not in an input field
      if (!selectedResponse || 
          event.target instanceof HTMLInputElement || 
          event.target instanceof HTMLTextAreaElement ||
          // Add additional checks for Tiptap editor
          (event.target instanceof HTMLElement && 
            (event.target.classList.contains('ProseMirror') || 
             event.target.closest('.ProseMirror') !== null))) {
        return;
      }
      
      // "T" key to open tag dropdown
      if (event.key === 't' || event.key === 'T') {
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
      
      toast.success("Tag created", {
        description: `"${quickTagName}" tag has been created.`
      });
    } catch (error: any) {
      console.error('Error creating tag:', error);
      
      // Handle unique constraint error
      if (error.code === '23505') {
        toast.error("Error", {
          description: "A tag with this name already exists."
        });
      } else {
        toast.error("Error", {
          description: "Failed to create tag."
        });
      }
    }
  };

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
                    "ml-auto tabular-nums",
                    activeFilter === 'open' 
                      ? "text-accent-foreground"
                      : feedbackCounts.open > 0 
                        ? "text-primary font-medium" 
                        : "text-muted-foreground"
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
                <div className="flex justify-between items-center mb-1 px-3">
                  <p className="text-xs uppercase text-muted-foreground font-medium tracking-wider">Favorite Tags</p>
                  <Popover open={showAddTagPopover} onOpenChange={setShowAddTagPopover}>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-5 w-5 p-0" 
                        onClick={() => setShowAddTagPopover(true)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80" side="right">
                      <div className="space-y-4">
                        <div className="font-medium text-sm">Create New Tag</div>
                        <div className="space-y-2">
                          <Label htmlFor="quick-tag-name">Tag Name</Label>
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
                          <Label>Tag Color</Label>
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
                            Create Tag
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <nav className="grid gap-0.5">
                  {availableTags
                    .filter(tag => tag.is_favorite)
                    .map(tag => (
                    <a
                      key={tag.id}
                      href="#"
                      className={cn(
                        "flex items-center gap-2 whitespace-nowrap text-sm font-medium h-8 rounded-md px-3 transition-colors",
                        typeof activeFilter === 'object' && activeFilter.id === tag.id
                          ? "bg-accent text-accent-foreground hover:bg-accent/90"
                          : "hover:bg-accent hover:text-accent-foreground"
                      )}
                      onClick={(e) => {
                        e.preventDefault();
                        handleFilterChange({ type: 'tag', id: tag.id, name: tag.name });
                      }}
                    >
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="truncate">{tag.name}</span>
                    </a>
                  ))}
                </nav>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 w-full text-xs justify-start text-muted-foreground font-normal"
                  onClick={() => setShowTagManagerDialog(true)}
                >
                  <Settings2 className="h-3 w-3 mr-1" />
                  Manage Tags
                </Button>
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
        {selectedFormId && (
          <>
            <div className="w-[30%] inbox-wrapper flex flex-col min-w-0 max-w-full h-full overflow-hidden">
              <header className="border-b border-border sticky top-0 bg-background z-10">
                <div className="container py-4 px-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base truncate">
                      {typeof activeFilter === 'object' && activeFilter.type === 'tag' 
                        ? `Tag: ${activeFilter.name}`
                        : activeFilter === 'open' 
                          ? 'Inbox' 
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
              <div className="container py-4 px-4 overflow-y-auto flex-1 h-[calc(100vh-65px)]">
                <div className="space-y-4">
                  <FeedbackInbox 
                    ref={inboxRef}
                    formId={selectedFormId} 
                    statusFilter={typeof activeFilter === 'object' ? 'all' : activeFilter}
                    tagFilter={typeof activeFilter === 'object' ? activeFilter.id : undefined}
                    onResponseSelect={setSelectedResponse}
                    onSelectionChange={setSelectedBatchIds}
                  />
                </div>
              </div>
            </div>
            
            {selectedResponse ? (
              <>
                <div className="w-[43%] conversation-wrapper border-l min-w-0 overflow-hidden h-full flex flex-col">
                  <header className="border-b border-border">
                    <div className="container py-3 px-4">
                      <div className="flex items-center justify-between">
                        <h2 className="text-base truncate">Conversation</h2>
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
                        </div>
                      </div>
                    </div>
                  </header>
                  <div className="container px-0 flex-1 h-[calc(100vh-65px)] overflow-hidden">
                    <ConversationThread 
                      response={selectedResponse} 
                      onStatusChange={handleResponseStatusChange}
                    />
                  </div>
                </div>
                
                <div className="hidden md:block w-[27%] flex-shrink-0 details-wrapper border-l min-w-0 overflow-hidden h-full flex flex-col">
                  <header className="border-b border-border">
                    <div className="container py-4 px-4">
                      <div className="flex items-center justify-between">
                        <h2 className="text-base truncate">Details</h2>
                      </div>
                    </div>
                  </header>
                  <div className="container p-4 overflow-y-auto h-[calc(100vh-65px)] flex-1">
                    <div className="space-y-6">
                      {/* Status section - removed as it's now in the conversation header */}
                      
                      {/* Tag section */}
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground flex items-center">
                          <span>Tag</span>
                          <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded ml-2">T</span>
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
                                  Select a tag
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
                                Clear tag
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      
                      {selectedResponse.image_url && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-muted-foreground">Image</p>
                          <button
                            onClick={() => setShowImagePreview(true)}
                            className="w-full rounded-lg border overflow-hidden hover:opacity-90 transition-opacity"
                          >
                            <img 
                              src={selectedResponse.image_url} 
                              alt={selectedResponse.image_name || 'Feedback image'} 
                              className="w-full"
                            />
                          </button>
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
                        
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          className="w-full"
                          onClick={() => handleResponseDelete(selectedResponse.id)}
                        >
                          Delete Feedback
                        </Button>
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
        {!selectedFormId && (
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
              // Refetch form data
              supabase
                .from('forms')
                .select('url, button_color, support_text, keyboard_shortcut, sound_enabled, show_gif_on_success, gif_urls, remove_branding')
                .eq('id', selectedFormId)
                .eq('owner_id', user?.id)
                .single()
                .then(({ data }) => {
                  if (data) {
                    setFormName(data.url);
                    setButtonColor(data.button_color);
                    setSupportText(data.support_text);
                    setKeyboardShortcut(data.keyboard_shortcut);
                    setSoundEnabled(data.sound_enabled);
                    setShowGifOnSuccess(data.show_gif_on_success);
                    setGifUrls(data.gif_urls || []);
                    setRemoveBranding(data.remove_branding);
                  }
                });
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
        {/* Image preview dialog */}
        {selectedResponse?.image_url && showImagePreview && (
          <Dialog open={showImagePreview} onOpenChange={setShowImagePreview}>
            <DialogContent className="max-w-3xl">
              <div className="flex justify-between mb-4">
                <h3 className="font-medium">Image Preview</h3>
                <div className="space-x-2">
                  <Button size="sm" onClick={handleDownload}>Download</Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => setShowImagePreview(false)}
                  >
                    Close
                  </Button>
                </div>
              </div>
              <div className="max-h-[70vh] overflow-auto">
                <img 
                  src={selectedResponse.image_url} 
                  alt={selectedResponse.image_name || 'Feedback image'} 
                  className="w-full"
                />
              </div>
            </DialogContent>
          </Dialog>
        )}
        {/* Batch action bar */}
        <BatchActionBar 
          selectedIds={selectedBatchIds}
          onClearSelection={() => {
            setSelectedBatchIds([]);
            if (inboxRef.current) {
              inboxRef.current.clearSelection();
            }
          }}
          onStatusChange={handleBatchStatusChange}
          onTagChange={handleBatchTagChange}
          availableTags={availableTags}
        />
        {/* Tag Manager Dialog */}
        <Dialog open={showTagManagerDialog} onOpenChange={setShowTagManagerDialog}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>Tag Manager</DialogTitle>
            </DialogHeader>
            {selectedFormId && (
              <TagManager 
                formId={selectedFormId} 
                onTagsChange={() => {
                  // Refresh tags
                  const fetchTags = async () => {
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
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}