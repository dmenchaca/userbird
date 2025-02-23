import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Loader, Trash2 } from 'lucide-react'
import { ResponseDetails } from './response-details'
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
} from '@/components/ui/alert-dialog'

interface ResponsesTableProps {
  formId: string
}

export function ResponsesTable({ formId }: ResponsesTableProps) {
  const [responses, setResponses] = useState<FeedbackResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [responseToDelete, setResponseToDelete] = useState<string | null>(null)
  const [selectedResponse, setSelectedResponse] = useState<FeedbackResponse | null>(null)

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
        const { data: responses, error } = await supabase
          .from('feedback')
          .select('*')
          .eq('form_id', formId)
          .order('created_at', { ascending: false })

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
        const { data } = await supabase
          .from('feedback')
          .select('*')
          .eq('form_id', formId)
          .order('created_at', { ascending: false })

        if (data) {
          setResponses(data)
        }
      })
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [formId])

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
    <div className="relative rounded-lg border bg-white">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground">Message</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground w-[100px]">Image</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground w-[120px]">User ID</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground">Email</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground">Name</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground">System</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground">Device</th>
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
                <td className="py-3 px-4 text-sm text-muted-foreground">
                  {response.screen_category}
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
      
      <ResponseDetails 
        response={selectedResponse} 
        onClose={() => setSelectedResponse(null)}
        onDelete={(id) => {
          setResponseToDelete(id)
          setSelectedResponse(null)
        }}
      />
      
      <AlertDialog open={!!responseToDelete} onOpenChange={() => setResponseToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Response</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this response? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setResponseToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}