import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { ChevronDown, Plus, Loader2, Check } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

interface Form {
  id: string
  url: string
  created_at: string
  feedback: { count: number }[]
}

export interface FormsDropdownProps {
  selectedFormId?: string
  onFormSelect: (formId: string) => void
  onNewFormClick: () => void
}

// Helper function to truncate URL for display
function truncateUrl(url: string): string {
  if (!url) return 'Unnamed Form';
  
  // Extract domain from URL if it's a full URL
  if (url.startsWith('http')) {
    try {
      const domain = new URL(url).hostname;
      return domain.replace(/^www\./, '');
    } catch (e) {
      return url.length > 30 ? url.substring(0, 30) + '...' : url;
    }
  }
  
  return url.length > 30 ? url.substring(0, 30) + '...' : url;
}

export function FormsDropdown({ 
  selectedFormId, 
  onFormSelect,
  onNewFormClick
}: FormsDropdownProps) {
  const { user } = useAuth()
  const [forms, setForms] = useState<Form[]>([])
  const [currentForm, setCurrentForm] = useState<Form | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch forms data
  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;

    async function fetchForms() {
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

        // Then get all forms where user is a collaborator
        const { data: collaboratedForms, error: collabError } = await supabase
          .from('form_collaborators')
          .select(`
            form:forms(
              id,
              url,
              created_at,
              feedback:feedback(count)
            )
          `)
          .eq('user_id', userId)
          .eq('invitation_accepted', true);

        if (collabError) {
          throw collabError;
        }

        // Combine the results, avoiding duplicates
        // Extract the actual forms from the nested form object and ensure proper typing
        const collaboratedFormsData = (collaboratedForms || [])
          .map(item => {
            // Handle the nested structure from the join
            const formData = item.form;
            // Check if it's a single form object or an array
            if (Array.isArray(formData)) {
              // If it's an array, take the first item if it exists
              return formData.length > 0 ? formData[0] as Form : null;
            }
            // Otherwise it's a single object
            return formData as Form;
          })
          .filter((form): form is Form => form !== null && form !== undefined);
        
        // Create a set of form IDs we already have
        const formIds = new Set((ownedForms || []).map(form => form.id));
        
        // Add forms that aren't duplicates
        const uniqueCollaboratedForms = collaboratedFormsData.filter(
          form => !formIds.has(form.id)
        );
        
        // Combine and sort by created_at
        const allForms = [...(ownedForms || []), ...uniqueCollaboratedForms]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        
        setForms(allForms || []);
        
        // Find the currently selected form
        if (selectedFormId) {
          const current = allForms?.find(form => form.id === selectedFormId) || null;
          setCurrentForm(current);
        } else if (allForms && allForms.length > 0) {
          setCurrentForm(allForms[0]);
        }
      } catch (error) {
        console.error('Error fetching forms:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchForms();
    
    // Set up subscriptions to refresh the list when changes happen
    
    // Subscribe to owned forms changes
    const ownedFormsChannel = supabase
      .channel(`forms_dropdown_owned_${Math.random()}`)
      .on(
        'postgres_changes',
        { 
          event: '*',
          schema: 'public',
          table: 'forms',
          filter: `owner_id=eq.${userId}`
        },
        () => fetchForms()
      )
      .subscribe();
    
    // Subscribe to collaborator changes
    const collabChannel = supabase
      .channel(`forms_dropdown_collab_${Math.random()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'form_collaborators',
          filter: `user_id=eq.${userId}`
        },
        () => fetchForms()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ownedFormsChannel);
      supabase.removeChannel(collabChannel);
    };
  }, [user?.id, selectedFormId]);

  if (loading) {
    return (
      <div className="px-4 py-2">
        <Button 
          variant="ghost" 
          disabled 
          className="h-9 px-3 justify-between whitespace-nowrap rounded-md py-2 text-sm bg-transparent data-[placeholder]:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-2 [&>span]:line-clamp-1 [&>span]:flex [&>span]:items-center [&>span]:gap-1 [&>span]:truncate [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0"
        >
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading forms...</span>
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </div>
    )
  }

  if (forms.length === 0) {
    return (
      <div className="px-4 py-2">
        <Button
          variant="ghost"
          onClick={onNewFormClick}
          className="h-9 px-3 justify-between whitespace-nowrap rounded-md py-2 text-sm bg-transparent data-[placeholder]:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-2 [&>span]:line-clamp-1 [&>span]:flex [&>span]:items-center [&>span]:gap-1 [&>span]:truncate [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0"
        >
          <span className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            <span>Create your first form</span>
          </span>
        </Button>
      </div>
    )
  }

  return (
    <div className="px-4 py-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            className="h-9 px-3 justify-between whitespace-nowrap rounded-md py-2 text-sm bg-transparent data-[placeholder]:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-2 [&>span]:line-clamp-1 [&>span]:flex [&>span]:items-center [&>span]:gap-1 [&>span]:truncate [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0"
          >
            <span style={{ pointerEvents: 'none' }}>
              {currentForm && <span>{truncateUrl(currentForm.url)}</span>}
              {!currentForm && <span>Select a form</span>}
            </span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          className="w-[240px]" 
          align="start"
        >
          <div className="max-h-[300px] overflow-y-auto">
            {forms.map((form) => (
              <DropdownMenuItem
                key={form.id}
                className={`cursor-pointer flex justify-between group hover:bg-accent`}
                onClick={() => onFormSelect(form.id)}
                style={{
                  backgroundColor: selectedFormId === form.id ? undefined : undefined,
                }}
                onMouseEnter={() => {
                  // No specific behavior needed here anymore
                }}
                onMouseLeave={() => {
                  // No specific behavior needed here anymore
                }}
              >
                <span className="truncate max-w-[180px]">{truncateUrl(form.url)}</span>
                <div className="flex items-center">
                  {selectedFormId === form.id && (
                    <Check className="h-4 w-4 ml-1 shrink-0" />
                  )}
                </div>
              </DropdownMenuItem>
            ))}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            className="cursor-pointer"
            onClick={onNewFormClick}
          >
            <Plus className="mr-2 h-4 w-4" />
            <span>Create new form</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
} 