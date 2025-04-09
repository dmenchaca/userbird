import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Loader } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NewFormDialog } from './new-form-dialog'
import { useAuth } from '@/lib/auth'

interface Form {
  id: string
  url: string
  created_at: string
  feedback: { count: number }[]
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
  const { user } = useAuth()
  const [forms, setForms] = useState<Form[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewFormDialog, setShowNewFormDialog] = useState(false)

  // Function to fetch forms - make it available to the subscription
  const fetchForms = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    
    const userId = user.id;
    console.log("Fetching forms for user ID:", userId); // Debug
    
    try {
      // First get all forms where user is owner
      const { data: ownedForms, error: ownedError } = await supabase
        .from('forms')
        .select(`
          id,
          url,
          created_at,
          feedback:feedback(count)
        `)
        .eq('owner_id', userId)
        .order('created_at', { ascending: false });

      if (ownedError) {
        throw ownedError;
      }

      // Note: Due to RLS recursion issues, we'll temporarily skip fetching collaborated forms
      // and only show forms the user owns
      setForms(ownedForms || []);
      setLoading(false);
      return;

      // The code below is commented out temporarily due to the RLS recursion issue
      /*
      // Then get all forms where user is a collaborator
      const { data: collaboratedForms, error: collabError } = await supabase
        .from('form_collaborators')
        .select(`
          form_id
        `)
        .eq('user_id', userId)
        .eq('invitation_accepted', true);

      if (collabError) {
        throw collabError;
      }

      // Get details for the forms user is collaborator on
      let collaboratedFormsData: Form[] = [];
      if (collaboratedForms && collaboratedForms.length > 0) {
        const formIds = collaboratedForms.map(collab => collab.form_id);
        const { data: formDetails, error: formDetailsError } = await supabase
          .from('forms')
          .select(`
            id,
            url,
            created_at,
            feedback:feedback(count)
          `)
          .in('id', formIds);
          
        if (formDetailsError) {
          console.error('Error fetching collaborator form details:', formDetailsError);
        } else {
          collaboratedFormsData = formDetails || [];
        }
      }

      // Create a set of form IDs we already have
      const formIds = new Set((ownedForms || []).map(form => form.id));
      
      // Add forms that aren't duplicates (though there shouldn't be any with this approach)
      const uniqueCollaboratedForms = collaboratedFormsData.filter(
        form => !formIds.has(form.id)
      );
      
      // Combine and sort by created_at
      const allForms = [...(ownedForms || []), ...uniqueCollaboratedForms]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setForms(allForms);
      */
    } catch (error) {
      console.error('Error fetching forms:', error);
      // Fallback to empty array if there's an error
      setForms([]);
    } finally {
      setLoading(false);
    }
  };

  // Call fetchForms when component mounts
  useEffect(() => {
    if (user?.id) {
      fetchForms();
    }
  }, [user?.id, selectedFormId]);

  // Set up subscriptions
  useEffect(() => {
    if (!user?.id) return;
    
    const userId = user.id;
    
    // For stable reference inside closure
    const handleFormSelect = onFormSelect;
    
    // Subscribe to owned forms changes
    const ownedFormsChannel = supabase
      .channel(`owned_forms_changes_${Math.random()}`)
      .on(
        'postgres_changes' as 'system',
        { 
          event: '*',
          schema: 'public',
          table: 'forms',
          filter: `owner_id=eq.${userId}`
        },
        (payload: {
          eventType: 'INSERT' | 'UPDATE' | 'DELETE';
          old: Form | null;
          new: Form | null;
        }) => {
          setForms(currentForms => {
            if (payload.eventType === 'DELETE') {
              if (!payload.old) return currentForms;
              
              const updatedForms = currentForms.filter(form => form.id !== payload.old?.id);
              
              // If the deleted form was selected, select another form
              if (selectedFormId === payload.old?.id) {
                if (updatedForms.length > 0) {
                  // Select the first available form
                  handleFormSelect(updatedForms[0].id);
                } else if (updatedForms.length === 0) {
                  // No forms left, clear selection
                  handleFormSelect('');
                }
              }
              
              return updatedForms;
            }

            if (payload.eventType === 'INSERT') {
              if (!payload.new) return currentForms;
              
              // Check if form already exists
              if (currentForms.some(form => form.id === payload.new!.id)) {
                return currentForms;
              }
              return [payload.new as Form, ...currentForms];
            }

            if (payload.eventType === 'UPDATE') {
              if (!payload.new) return currentForms;
              return currentForms.map(form => 
                form.id === payload.new?.id ? (payload.new as Form) : form
              );
            }
            
            return currentForms;
          });
        }
      ).subscribe();

    // Subscribe to collaborator changes
    const collaboratorChannel = supabase
      .channel(`collaborator_changes_${Math.random()}`)
      .on(
        'postgres_changes' as 'system',
        {
          event: '*',
          schema: 'public',
          table: 'form_collaborators',
          filter: `user_id=eq.${userId}`
        },
        () => {
          // When collaborator status changes, refresh the forms list
          fetchForms();
        }
      ).subscribe();

    return () => {
      supabase.removeChannel(ownedFormsChannel);
      supabase.removeChannel(collaboratorChannel);
    }
  }, [user?.id, selectedFormId, onFormSelect])

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (forms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <p className="text-sm text-muted-foreground">No forms yet</p>
        <NewFormDialog
          open={showNewFormDialog}
          onOpenChange={setShowNewFormDialog}
          onFormSelect={onFormSelect}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2 -mx-2">
      {forms.map((form) => (
        <button
          key={form.id}
          onClick={() => {
            onFormSelect(form.id)
          }}
          className={cn(
            "w-full py-2 text-left rounded-md hover:bg-accent transition-colors font-normal",
            selectedFormId === form.id && "bg-accent"
          )}>
          <div className="flex items-center justify-between px-2 text-sm">
            <TruncatedUrl url={form.url} />
            {form.feedback?.[0]?.count !== undefined && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {form.feedback[0].count}
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  )
}