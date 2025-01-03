import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Loader } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Form {
  id: string
  url: string
  created_at: string
}

interface FormsListProps {
  selectedFormId?: string
  onFormSelect: (formId: string) => void
}

function TruncatedUrl({ url }: { url: string }) {
  if (url.length <= 25) return <span>{url}</span>;
  
  // Extract domain and path
  let displayUrl = url;
  try {
    const urlObj = new URL(`https://${url}`);
    displayUrl = urlObj.hostname;
  } catch {
    // If URL parsing fails, fallback to simple truncation
    displayUrl = url;
  }
  
  return (
    <span className="group relative">
      <span>{displayUrl.slice(0, 22)}...</span>
      <span className="invisible group-hover:visible absolute left-0 -top-8 bg-popover text-popover-foreground text-xs py-1 px-2 rounded shadow-lg whitespace-nowrap">
        {url}
      </span>
    </span>
  );
}

export function FormsList({ selectedFormId, onFormSelect }: FormsListProps) {
  const [forms, setForms] = useState<Form[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch initial forms data
  useEffect(() => {
    async function fetchForms() {
      console.log('Fetching initial forms data...');
      try {
        const { data, error } = await supabase
          .from('forms')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) {
          console.error('Error fetching initial forms:', error);
          throw error;
        }
        console.log('Initial forms data:', data);
        setForms(data || [])
      } catch (error) {
        console.error('Error fetching forms:', error)
      } finally {
        console.log('Initial forms fetch complete');
        setLoading(false)
      }
    }

    fetchForms()
  }, [])

  // Set up real-time subscription
  useEffect(() => {
    console.log('Setting up real-time subscription...');
    const channel = supabase
      .channel('forms_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'forms' },
        (payload) => {
          console.log('Forms change event received:', payload);

          if (payload.eventType === 'DELETE') {
            console.log('Handling DELETE event, removing form:', payload.old.id);
            setForms((current) => {
              console.log('Current forms before DELETE:', current);
              const updated = current.filter(form => form.id !== payload.old.id);
              console.log('Updated forms after DELETE:', updated);
              return updated;
            });
            return
          }

          console.log('Handling INSERT/UPDATE event, adding form:', payload.new);
          setForms((current) => {
            console.log('Current forms before INSERT/UPDATE:', current);
            const updated = [payload.new as Form, ...current];
            console.log('Updated forms after INSERT/UPDATE:', updated);
            return updated;
          });
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
        console.log('Subscription channel:', channel);
      })

    return () => {
      console.log('Cleaning up forms subscription');
      console.log('Unsubscribing from channel:', channel);
      supabase.removeChannel(channel)
    }
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (forms.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No forms created yet
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start gap-2">
      {forms.map((form) => (
        <button
          key={form.id}
          onClick={() => onFormSelect(form.id)}
          className={cn(
            "w-full px-4 py-2 text-left rounded-md hover:bg-accent transition-colors",
            selectedFormId === form.id && "bg-accent"
          )}>
          <div className="text-sm font-medium">
            <TruncatedUrl url={form.url} />
          </div>
        </button>
      ))}
    </div>
  )
}