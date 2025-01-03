import { useState, useCallback } from 'react'
import { FormCreator } from './components/form-creator'
import { FormsList } from './components/forms-list'
import { ResponsesTable } from './components/responses-table'
import { Button } from './components/ui/button'
import { Trash2 } from 'lucide-react'
import { supabase } from './lib/supabase'

export default function App() {
  const [selectedFormId, setSelectedFormId] = useState<string>()
  
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
      <aside className="fixed left-0 w-64 h-screen border-r bg-white">
        <div className="flex flex-col h-full">
          <div className="p-4 border-b">
            <h1 className="text-lg font-semibold text-gray-900">Userbird</h1>
          </div>
          <div className="flex-1 p-4 space-y-4">
            <h2 className="font-semibold">Your Forms</h2>
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