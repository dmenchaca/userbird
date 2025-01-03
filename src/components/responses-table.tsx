import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Loader } from 'lucide-react'

interface Response {
  id: string
  message: string
  created_at: string
}

interface ResponsesTableProps {
  formId: string
}

export function ResponsesTable({ formId }: ResponsesTableProps) {
  const [responses, setResponses] = useState<Response[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchResponses() {
      try {
        const { data, error } = await supabase
          .from('feedback')
          .select('*')
          .eq('form_id', formId)
          .order('created_at', { ascending: false })

        if (error) throw error
        setResponses(data || [])
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
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'feedback',
          filter: `form_id=eq.${formId}`,
        },
        (payload) => {
          setResponses((current) => [payload.new as Response, ...current])
        }
      )
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
    <div className="rounded-lg border bg-white">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="py-3 px-4 text-left font-medium text-muted-foreground">Message</th>
              <th className="py-3 px-4 text-left font-medium text-muted-foreground">System</th>
              <th className="py-3 px-4 text-left font-medium text-muted-foreground">Device</th>
              <th className="py-3 px-4 text-left font-medium text-muted-foreground w-[180px]">Date</th>
            </tr>
          </thead>
          <tbody>
            {responses.map((response) => (
              <tr key={response.id} className="border-b last:border-0">
                <td className="py-3 px-4 text-sm">{response.message}</td>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}