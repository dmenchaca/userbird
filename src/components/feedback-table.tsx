import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Feedback {
  id: string
  message: string
  created_at: string
}

interface FeedbackTableProps {
  formId: string
}

export function FeedbackTable({ formId }: FeedbackTableProps) {
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchFeedback() {
      try {
        const { data, error } = await supabase
          .from('feedback')
          .select('*')
          .eq('form_id', formId)
          .order('created_at', { ascending: false })

        if (error) throw error
        setFeedback(data || [])
      } catch (error) {
        console.error('Error fetching feedback:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchFeedback()

    // Subscribe to new feedback
    const channel = supabase
      .channel('feedback_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'feedback',
          filter: `form_id=eq.${formId}`,
        },
        (payload) => {
          setFeedback((current) => [payload.new as Feedback, ...current])
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [formId])

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  if (feedback.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No feedback submissions yet
      </div>
    )
  }

  return (
    <div className="rounded-lg border">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="py-3 px-4 text-left font-medium">Message</th>
            <th className="py-3 px-4 text-left font-medium w-[180px]">Date</th>
          </tr>
        </thead>
        <tbody>
          {feedback.map((item) => (
            <tr key={item.id} className="border-b last:border-0">
              <td className="py-3 px-4">{item.message}</td>
              <td className="py-3 px-4 text-muted-foreground">
                {new Date(item.created_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}