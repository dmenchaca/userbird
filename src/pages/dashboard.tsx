import { useState, useCallback, useEffect } from 'react'
import { ResponsesTable } from '@/components/responses-table'
import { Button } from '@/components/ui/button'
import { Download, Plus, Code2, Settings2, Loader, Inbox, CheckCircle, ListFilter } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { InstallInstructionsModal } from '@/components/install-instructions-modal'
import { FormSettingsDialog } from '@/components/form-settings-dialog'
import { NewFormDialog } from '@/components/new-form-dialog'
import { useAuth } from '@/lib/auth'
import { UserMenu } from '@/components/user-menu'
import { useNavigate } from 'react-router-dom'
import { FormsDropdown } from '@/components/forms-dropdown'
import { cn } from '@/lib/utils'

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
  const [activeFilter, setActiveFilter] = useState<'all' | 'open' | 'closed'>('all')
  
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
  const handleFilterChange = (filter: 'all' | 'open' | 'closed') => {
    setActiveFilter(filter);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="fixed left-0 w-64 h-screen border-r bg-[#FAFAFA]">
        <div className="flex flex-col h-full">
          <div className="px-3 py-4 border-b">
            <FormsDropdown 
              selectedFormId={selectedFormId}
              onFormSelect={setSelectedFormId}
              onNewFormClick={() => setShowNewFormDialog(true)}
            />
          </div>
          <div className="flex-1 p-4 space-y-4">
            {selectedFormId && (
              <nav className="space-y-1">
                <Button
                  variant={activeFilter === 'open' ? 'secondary' : 'ghost'}
                  className="w-full justify-between h-10 px-3 font-normal"
                  onClick={() => handleFilterChange('open')}
                >
                  <div className="flex items-center">
                    <Inbox className="mr-2 h-4 w-4" />
                    <span>Inbox</span>
                  </div>
                  <span className={cn(
                    "text-xs rounded-full px-2 py-0.5 tabular-nums",
                    feedbackCounts.open > 0 
                      ? "bg-primary/10 text-primary font-medium" 
                      : "bg-muted text-muted-foreground"
                  )}>
                    {feedbackCounts.open}
                  </span>
                </Button>
                
                <Button
                  variant={activeFilter === 'closed' ? 'secondary' : 'ghost'}
                  className="w-full justify-between h-10 px-3 font-normal"
                  onClick={() => handleFilterChange('closed')}
                >
                  <div className="flex items-center">
                    <CheckCircle className="mr-2 h-4 w-4" />
                    <span>Closed</span>
                  </div>
                  <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5 tabular-nums">
                    {feedbackCounts.closed}
                  </span>
                </Button>
                
                <Button
                  variant={activeFilter === 'all' ? 'secondary' : 'ghost'}
                  className="w-full justify-between h-10 px-3 font-normal"
                  onClick={() => handleFilterChange('all')}
                >
                  <div className="flex items-center">
                    <ListFilter className="mr-2 h-4 w-4" />
                    <span>View all</span>
                  </div>
                  <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5 tabular-nums">
                    {feedbackCounts.open + feedbackCounts.closed}
                  </span>
                </Button>
              </nav>
            )}
          </div>
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
      <main className="ml-64 flex-1">
        {selectedFormId && (
          <header className="border-b border-border">
            <div className="container py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base">{formName}</h2>
                <div className="flex gap-2">
                  {!hasResponses && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setShowInstallModal(true)}
                      className="gap-2"
                    >
                      <Code2 className="w-4 h-4" />
                      Install Instructions
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSettingsDialog(true)}
                    className="gap-2"
                  >
                    <Settings2 className="w-4 h-4" />
                    Settings
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                    className="gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </Button>
                </div>
              </div>
            </div>
          </header>
        )}
        <div className="container py-12 px-8 space-y-8">
          {selectedFormId ? (
            <div className="space-y-6">
              <ResponsesTable 
                formId={selectedFormId} 
                statusFilter={activeFilter} 
                onFilterChange={handleFilterChange}
              />
            </div>
          ) : (
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
          )}
        </div>
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
          />
        )}
      </main>
    </div>
  )
}