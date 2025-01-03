import { useState, useCallback } from 'react'
import { FormCreator } from './components/form-creator'
import { FormsList } from './components/forms-list'
import { ResponsesTable } from './components/responses-table'
import { Button } from './components/ui/button'
import { Trash2, Bird } from 'lucide-react'
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
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 15 15"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="text-foreground"
                >
                  <path
                    d="M8 2.75C8 2.47386 7.77614 2.25 7.5 2.25C7.22386 2.25 7 2.47386 7 2.75V7H2.75C2.47386 7 2.25 7.22386 2.25 7.5C2.25 7.77614 2.47386 8 2.75 8H7V12.25C7 12.5261 7.22386 12.75 7.5 12.75C7.77614 12.75 8 12.5261 8 12.25V8H12.25C12.5261 8 12.75 7.77614 12.75 7.5C12.75 7.22386 12.5261 7 12.25 7H8V2.75Z"
                    fill="currentColor"
                    fillRule="evenodd"
                    clipRule="evenodd"
                  />
                </svg>
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