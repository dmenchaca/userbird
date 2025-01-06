import { useState, useCallback, useEffect } from 'react'
import { FormCreator } from '@/components/form-creator'
import { FormsList } from '@/components/forms-list'
import { ResponsesTable } from '@/components/responses-table'
import { Button } from '@/components/ui/button'
import { Bird, Download, Plus, Code2, Settings2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { InstallInstructionsModal } from '@/components/install-instructions-modal'
import { FormSettingsDialog } from '@/components/form-settings-dialog'
import { useAuth } from '@/lib/auth'
import { UserMenu } from '@/components/user-menu'

export function Dashboard() {
  const { user } = useAuth()
  const [selectedFormId, setSelectedFormId] = useState<string>()
  const [formName, setFormName] = useState<string>('')
  const [buttonColor, setButtonColor] = useState('#1f2937')
  const [supportText, setSupportText] = useState<string | null>(null)
  const [hasResponses, setHasResponses] = useState(false)
  const [showInstallModal, setShowInstallModal] = useState(false)
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  
  // Fetch form name when form is selected
  useEffect(() => {
    if (selectedFormId) {
      supabase
        .from('forms')
        .select('url, button_color, support_text')
        .eq('id', selectedFormId)
        .eq('owner_id', user?.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setFormName(data.url)
            setButtonColor(data.button_color)
            setSupportText(data.support_text)
          }
        })
    }
  }, [selectedFormId, user?.id])

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
      
      setSelectedFormId(undefined)
    } catch (error) {
      console.error('Error deleting form:', error)
    }
  }, [selectedFormId])

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="fixed left-0 w-64 h-screen border-r bg-[#FAFAFA]">
        <div className="flex flex-col h-full">
          <div className="p-4">
            <h1 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Bird className="w-5 h-5" />
              Userbird
            </h1>
          </div>
          <div className="flex-1 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-medium">Forms</h2>
              <button
                onClick={() => setSelectedFormId(undefined)}
                className="w-6 h-6 rounded-full hover:bg-accent flex items-center justify-center group relative"
              >
                <Plus className="w-5 h-5" />
                <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-xs py-1 px-2 rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                  Create new form
                </span>
              </button>
            </div>
            <FormsList
              selectedFormId={selectedFormId}
              onFormSelect={setSelectedFormId}
            />
          </div>
          <UserMenu />
        </div>
      </aside>
      <main className="ml-64 flex-1">
        <header className="border-b border-border">
          <div className="container py-4">
            {selectedFormId && (
              <div className="flex items-center justify-between">
                <h2 className="text-base">{formName}</h2>
                <div className="flex gap-2">
                  {!hasResponses && (
                    <Button
                      variant="outline"
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
            )}
          </div>
        </header>
        <div className="container py-12 px-8 space-y-8">
          {selectedFormId ? (
            <div className="space-y-6">
              <ResponsesTable formId={selectedFormId} />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-muted-foreground">Create a feedback form for your website in seconds.</p>
              </div>
              <FormCreator />
            </>
          )}
        </div>
        {selectedFormId && (
          <InstallInstructionsModal
            formId={selectedFormId}
            open={showInstallModal}
            onOpenChange={setShowInstallModal}
          />
        )}
        {selectedFormId && (
          <FormSettingsDialog
            open={showSettingsDialog}
            onOpenChange={setShowSettingsDialog}
            onSettingsSaved={() => {
              // Refetch form data
              supabase
                .from('forms')
                .select('url, button_color, support_text')
                .eq('id', selectedFormId)
                .eq('owner_id', user?.id)
                .single()
                .then(({ data }) => {
                  if (data) {
                    setFormName(data.url);
                    setButtonColor(data.button_color);
                    setSupportText(data.support_text);
                  }
                });
            }}
            onDelete={handleDelete}
            formId={selectedFormId}
            formUrl={formName}
            buttonColor={buttonColor}
            supportText={supportText}
          />
        )}
      </main>
    </div>
  )
}