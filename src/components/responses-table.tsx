import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Loader, Trash2, Smartphone, Tablet, Monitor, Inbox, CheckCircle } from 'lucide-react'
import { FeedbackResponse } from '@/lib/types/feedback'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog'

interface ResponsesTableProps {
  formId: string
  statusFilter?: 'all' | 'open' | 'closed'
  onFilterChange?: (filter: 'all' | 'open' | 'closed') => void
}

export function ResponsesTable({
  formId,
  statusFilter: externalStatusFilter = 'all',
}: ResponsesTableProps) {
  const [responses, setResponses] = useState<FeedbackResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [responseToDelete, setResponseToDelete] = useState<string | null>(null)
  const [selectedResponse, setSelectedResponse] = useState<FeedbackResponse | null>(null)
  
  // Use the status filter coming from props
  const currentStatusFilter = externalStatusFilter;

  const handleDelete = async () => {
    if (!responseToDelete) return

    try {
      const { error } = await supabase
        .from('feedback')
        .delete()
        .eq('id', responseToDelete)

      if (error) throw error

      setResponses(current => current.filter(response => response.id !== responseToDelete))
    } catch (error) {
      console.error('Error deleting response:', error)
    } finally {
      setResponseToDelete(null)
    }
  }

  useEffect(() => {
    async function fetchResponses() {
      try {
        let query = supabase
          .from('feedback')
          .select('*')
          .eq('form_id', formId)
          .order('created_at', { ascending: false })
        
        // Apply status filter if not showing all
        if (currentStatusFilter !== 'all') {
          query = query.eq('status', currentStatusFilter)
        }

        const { data: responses, error } = await query

        if (error) throw error
        setResponses(responses || [])
      } catch (error) {
        console.error('Error fetching responses:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchResponses()

    // Subscribe to new responses
    const channel = supabase
      .channel('responses_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'feedback',
        filter: `form_id=eq.${formId}`
      }, async () => {
        // Refetch all responses to ensure consistency
        let query = supabase
          .from('feedback')
          .select('*')
          .eq('form_id', formId)
          .order('created_at', { ascending: false })
        
        // Apply status filter if not showing all
        if (currentStatusFilter !== 'all') {
          query = query.eq('status', currentStatusFilter)
        }
        
        const { data } = await query

        if (data) {
          setResponses(data)
        }
      })
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [formId, currentStatusFilter])

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

  return (
    <div className="space-y-2">
      <div className="relative rounded-lg border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground">Message</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground w-[100px]">Image</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground w-[120px]">User ID</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground">Email</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground">Name</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground">System</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground">Page URL</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground">Device</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground w-[80px]">Status</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground w-[180px]">Date</th>
                <th className="py-3 px-4 w-[50px]"></th>
              </tr>
            </thead>
            <tbody>
              {responses.map((response) => (
                <tr 
                  key={response.id} 
                  className="border-b last:border-0 cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedResponse(response)}
                >
                  <td className="py-3 px-4 text-sm">
                    <p className="line-clamp-2">{response.message}</p>
                  </td>
                  <td className="py-3 px-4 h-[60px]">
                    {response.image_url && (
                      <img 
                        src={response.image_url} 
                        alt={response.image_name || 'Feedback image'} 
                        className="w-10 h-10 object-cover rounded"
                      />
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground relative group">
                    {response.user_id ? (
                      <span className="group relative">
                        <span>
                          {response.user_id.length > 12 
                            ? `${response.user_id.slice(0, 4)}...${response.user_id.slice(-4)}`
                            : response.user_id}
                        </span>
                        <span className="invisible group-hover:visible absolute left-0 -top-8 bg-popover text-popover-foreground text-xs py-1 px-2 rounded shadow-lg whitespace-nowrap">
                          {response.user_id}
                        </span>
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">
                    {response.user_email || '-'}
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">
                    {response.user_name || '-'}
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">
                    {response.operating_system}
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground relative group">
                    {response.url_path ? (
                      <span className="group relative">
                        <span>
                          {response.url_path.length > 15
                            ? `${response.url_path.slice(0, 12)}...`
                            : response.url_path}
                        </span>
                        <span className="invisible group-hover:visible absolute left-0 -top-8 bg-popover text-popover-foreground text-xs py-1 px-2 rounded shadow-lg whitespace-nowrap">
                          {response.url_path}
                        </span>
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground relative group">
                    <span className="group relative">
                      {response.screen_category === 'Mobile' && (
                        <Smartphone className="w-4 h-4" />
                      )}
                      {response.screen_category === 'Tablet' && (
                        <Tablet className="w-4 h-4" />
                      )}
                      {response.screen_category === 'Desktop' && (
                        <Monitor className="w-4 h-4" />
                      )}
                      <span className="invisible group-hover:visible absolute left-1/2 -translate-x-1/2 -top-8 bg-popover text-popover-foreground text-xs py-1 px-2 rounded shadow-lg whitespace-nowrap">
                        {response.screen_category}
                      </span>
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm relative group">
                    <span className={`inline-flex items-center ${
                      response.status === 'open' 
                        ? 'text-blue-500' 
                        : 'text-green-500'
                    }`}>
                      {response.status === 'open' 
                        ? <Inbox className="w-3 h-3 mr-1" /> 
                        : <CheckCircle className="w-3 h-3 mr-1" />}
                      {response.status === 'open' ? 'Inbox' : 'Closed'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">
                    <span title={new Date(response.created_at).toLocaleString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    })}>
                      {new Date(response.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setResponseToDelete(response.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {selectedResponse && (
        <div className="fixed inset-y-0 right-0 w-full md:w-96 bg-background border-l shadow-lg z-50 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-medium">Feedback Details</h3>
            <button 
              className="rounded-full p-1 hover:bg-muted transition-colors"
              onClick={() => setSelectedResponse(null)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              <p className="text-sm whitespace-pre-wrap">{selectedResponse.message}</p>
              
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">User Information</p>
                  <div className="text-sm space-y-1">
                    <p>ID: {selectedResponse.user_id || '-'}</p>
                    <p>Email: {selectedResponse.user_email || '-'}</p>
                    <p>Name: {selectedResponse.user_name || '-'}</p>
                    <p>Page URL: {selectedResponse.url_path || '-'}</p>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">System Information</p>
                  <div className="text-sm space-y-1">
                    <p>OS: {selectedResponse.operating_system}</p>
                    <p>Device: {selectedResponse.screen_category}</p>
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
                
                <button 
                  className="w-full py-2 px-4 bg-destructive text-destructive-foreground rounded-md text-sm hover:bg-destructive/90 transition-colors"
                  onClick={() => {
                    setResponseToDelete(selectedResponse.id)
                    setSelectedResponse(null)
                  }}
                >
                  Delete Feedback
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <AlertDialog open={!!responseToDelete} onOpenChange={() => setResponseToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the response.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}