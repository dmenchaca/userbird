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
      .channel(`forms_changes_${Math.random()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'forms' },
        (payload) => {
          console.log('Forms change event received:', payload);
          setForms(currentForms => {
            if (payload.eventType === 'DELETE') {
              return currentForms.filter(form => form.id !== payload.old.id);
            }

            if (payload.eventType === 'INSERT') {
              const newForm = payload.new as Form;
              // Check if form already exists
              if (currentForms.some(form => form.id === newForm.id)) {
                return currentForms;
              }
              return [newForm, ...currentForms];
            }

            if (payload.eventType === 'UPDATE') {
              return currentForms.map(form => 
                form.id === payload.new.id ? payload.new as Form : form
              );
            }
            
            return currentForms;
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
            "w-full py-2 text-left rounded-md hover:bg-accent transition-colors font-normal",
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