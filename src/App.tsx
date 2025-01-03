import { useState, useCallback, useEffect } from 'react'
import { FormCreator } from './components/form-creator'
import { FormsList } from './components/forms-list'
import { ResponsesTable } from './components/responses-table'
import { Button } from './components/ui/button'
import { Trash2, Bird, Download, Plus } from 'lucide-react'
import { supabase } from './lib/supabase'

export default function App() {
  const [selectedFormId, setSelectedFormId] = useState<string>()
  const [formName, setFormName] = useState<string>('')
  
  // Fetch form name when form is selected
  useEffect(() => {
    if (selectedFormId) {
      supabase
        .from('forms')
        .select('url')
        .eq('id', selectedFormId)
        .single()
        .then(({ data }) => {
          if (data) setFormName(data.url)
        })
    }
  }, [selectedFormId])

  const handleExport = useCallback(async () => {
    if (!selectedFormId) return

    try {
      const { data, error } = await supabase
        .from('feedback')
        .select('message, created_at')
        .eq('form_id', selectedFormId)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Convert to CSV
      const csvContent = [
        ['Message', 'Date'],
        ...(data || []).map(row => [
          `"${row.message.replace(/"/g, '""')}"`,
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
    if (!selectedFormId) return
    
    if (window.confirm('Are you sure you want to delete this form? This action cannot be undone.')) {
      try {
        const { error: deleteError } = await supabase
          .from('forms')
          .delete()
          .eq('id', selectedFormId)
        
        if (deleteError) throw deleteError

        // Fetch updated forms list
        const { error: fetchError } = await supabase
          .from('forms')
          .select('*')
          .order('created_at', { ascending: false })

        if (fetchError) throw fetchError
        
        setSelectedFormId(undefined)
      } catch (error) {
        console.error('Error deleting form:', error)
      }
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
              <h2 className="font-semibold">Forms</h2>
              <button
                onClick={() => setSelectedFormId(undefined)}
                className="w-6 h-6 rounded-full hover:bg-accent flex items-center justify-center group relative"
              >
                <Plus className="w-4 h-4" />
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
        </div>
      </aside>
      <main className="ml-64 flex-1">
        <div className="container max-w-4xl py-12 px-8 space-y-8">
          {selectedFormId ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Form Responses</h2>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                    className="gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDelete}
                    className="gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Form
                  </Button>
                </div>
              </div>
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
      </main>
    </div>
  )
}