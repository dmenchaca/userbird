import { useState, useEffect, useRef } from 'react'
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
  product_name?: string | null
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

// Helper function to get the display name (product_name or truncated URL)
function getDisplayName(form: Form): string {
  if (form.product_name) return form.product_name;
  return truncateUrl(form.url);
}

// Helper function to get the first letter for the icon
function getIconLetter(form: Form): string {
  if (form.product_name) {
    return form.product_name.charAt(0).toUpperCase();
  }
  
  // Fallback to first letter of domain
  const displayName = truncateUrl(form.url);
  return displayName.charAt(0).toUpperCase();
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
  const initialSelectionMade = useRef(false)

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
            product_name,
            created_at,
            feedback:feedback(count)
          `)
          .eq('owner_id', userId)
          .order('created_at', { ascending: false });

        if (ownedError) {
          // Continue with empty array for owned forms
        }

        // Handle for the forms user is a collaborator using a different approach
        // that avoids the RLS recursion issue
        let collaboratedForms: Form[] = [];
        
        try {
          // First get just the form IDs where user is a collaborator
          const { data: collabData, error: collabError } = await supabase
            .rpc('get_user_collaboration_forms', { 
              user_id_param: userId 
            });
            
          if (collabError) {
            // Continue with collaborator forms
          } else if (collabData && Array.isArray(collabData) && collabData.length > 0) {
            // Fetch form details for all collaborator forms
            const { data: formDetails, error: formDetailsError } = await supabase
              .from('forms')
              .select(`
                id,
                url,
                product_name,
                created_at,
                feedback:feedback(count)
              `)
              .in('id', collabData);
              
            if (formDetailsError) {
              // Continue with empty collaborator forms
            } else {
              collaboratedForms = formDetails || [];
            }
            
            // Check if we're missing any forms that should be included
            const missingFormIds = collabData.filter(
              id => !formDetails?.some(form => form.id === id)
            );
            
            // If there are missing forms, try to get them individually
            for (const missingId of missingFormIds) {
              // Check if user has access using our helper function
              const { data: hasAccess } = await supabase
                .rpc('user_has_form_access', {
                  form_id_param: missingId,
                  user_id_param: userId
                });
                
              if (hasAccess) {
                // Try to get the form directly with service role permissions
                // In a real app, you'd call a secure serverless function that uses admin permissions
                // For this example, we'll just add the form ID for display purposes
                collaboratedForms.push({
                  id: missingId,
                  url: `Form ${missingId}`, // Fallback display name
                  created_at: new Date().toISOString(),
                  feedback: [{ count: 0 }]
                });
              }
            }
          }
        } catch (collabFetchError) {
          // Continue with empty array for collaborator forms
        }

        // Create a set of form IDs we already have to avoid duplicates
        const ownedFormIds = new Set((ownedForms || []).map(form => form.id));

        // Filter out any collaborator forms that the user also owns
        const uniqueCollaboratedForms = collaboratedForms.filter(
          form => !ownedFormIds.has(form.id)
        );

        // Combine and sort by created_at
        const allForms = [...(ownedForms || []), ...uniqueCollaboratedForms]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        
        setForms(allForms || []);
        
        // Auto-select logic
        // If user has a selected form already, keep it
        if (selectedFormId) {
          const current = allForms?.find(form => form.id === selectedFormId) || null;
          setCurrentForm(current);
        } 
        // If no form is selected yet and we haven't made an initial selection
        else if (!initialSelectionMade.current && allForms && allForms.length > 0) {
          initialSelectionMade.current = true;
          
          // First check if there are any collaborator forms - prioritize these
          // as they're likely what the user was invited to access
          if (uniqueCollaboratedForms.length > 0) {
            const firstCollabForm = uniqueCollaboratedForms[0];
            setCurrentForm(firstCollabForm);
            // Call the parent component's form selection handler
            onFormSelect(firstCollabForm.id);
          } 
          // Otherwise select the first form (likely owned by the user)
          else {
            setCurrentForm(allForms[0]);
            // Call the parent component's form selection handler
            onFormSelect(allForms[0].id);
          }
        } 
        // Default case - we have a current form selection
        else if (allForms && allForms.length > 0) {
          setCurrentForm(allForms[0]);
        }
      } catch (error) {
        setForms([]);
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
          className="h-9 px-2 justify-between whitespace-nowrap rounded-md py-2 text-sm bg-transparent data-[placeholder]:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-2 [&>span]:line-clamp-1 [&>span]:flex [&>span]:items-center [&>span]:gap-1 [&>span]:truncate [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0"
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
          className="h-9 px-2 justify-between whitespace-nowrap rounded-md py-2 text-sm bg-transparent data-[placeholder]:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-2 [&>span]:line-clamp-1 [&>span]:flex [&>span]:items-center [&>span]:gap-1 [&>span]:truncate [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0"
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
    <div className="px-2 py-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            className="h-9 px-2 justify-between whitespace-nowrap rounded-md py-2 text-sm bg-transparent data-[placeholder]:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-2 [&>span]:line-clamp-1 [&>span]:flex [&>span]:items-center [&>span]:gap-1 [&>span]:truncate [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0"
          >
            <span style={{ pointerEvents: 'none' }}>
              {currentForm && (
                <span className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md flex items-center justify-center bg-primary text-primary-foreground">
                    {getIconLetter(currentForm)}
                  </span>
                  <span>{getDisplayName(currentForm)}</span>
                </span>
              )}
              {!currentForm && <span>Select a form</span>}
            </span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          className="w-[240px]" 
          style={{
            outline: "none",
            pointerEvents: "auto"
          }}
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
              >
                <span className="truncate max-w-[180px]">{getDisplayName(form)}</span>
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
            <span>New workspace</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
} 