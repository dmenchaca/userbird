import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { ChevronDown, Plus, Loader2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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

    async function fetchForms() {
      try {
        const { data, error } = await supabase
          .from('forms')
          .select(`
            id,
            url,
            created_at,
            feedback:feedback(count)
          `)
          .eq('owner_id', user?.id)
          .order('created_at', { ascending: false })

        if (error) {
          throw error;
        }
        setForms(data || [])
        
        // Find the currently selected form
        if (selectedFormId) {
          const current = data?.find(form => form.id === selectedFormId) || null
          setCurrentForm(current)
        } else if (data && data.length > 0) {
          setCurrentForm(data[0])
        }
      } catch (error) {
        console.error('Error fetching forms:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchForms()
  }, [user?.id, selectedFormId])

  // Set up real-time subscriptions
  useEffect(() => {
    if (!user?.id) return;
    
    // Subscribe to form changes
    const formsChannel = supabase
      .channel(`forms_dropdown_changes_${Math.random()}`)
      .on(
        'postgres_changes' as 'system',
        { 
          event: '*',
          schema: 'public',
          table: 'forms',
          filter: `owner_id=eq.${user.id}`
        },
        (payload: {
          eventType: 'INSERT' | 'UPDATE' | 'DELETE';
          old: Form | null;
          new: Form | null;
        }) => {
          setForms(currentForms => {
            let updatedForms = [...currentForms];
            
            if (payload.eventType === 'DELETE') {
              if (!payload.old) return currentForms;
              updatedForms = currentForms.filter(form => form.id !== payload.old?.id);
            }

            if (payload.eventType === 'INSERT') {
              if (!payload.new) return currentForms;
              
              // Check if form already exists
              if (!currentForms.some(form => form.id === payload.new!.id)) {
                updatedForms = [payload.new as Form, ...currentForms];
              }
            }

            if (payload.eventType === 'UPDATE') {
              if (!payload.new) return currentForms;
              updatedForms = currentForms.map(form => 
                form.id === payload.new?.id ? (payload.new as Form) : form
              );
            }
            
            // Update current form if needed
            if (selectedFormId) {
              const current = updatedForms.find(form => form.id === selectedFormId) || null;
              setCurrentForm(current);
            }
            
            return updatedForms;
          });
        }
      ).subscribe()

    return () => {
      supabase.removeChannel(formsChannel)
    }
  }, [user?.id, selectedFormId])

  if (loading) {
    return (
      <Button 
        variant="ghost" 
        disabled 
        className="w-full justify-between h-10 font-medium"
      >
        <span className="flex items-center">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading forms...
        </span>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
    )
  }

  if (forms.length === 0) {
    return (
      <Button
        variant="ghost"
        onClick={onNewFormClick}
        className="w-full justify-start h-10 font-medium"
      >
        <span className="flex items-center">
          <Plus className="mr-2 h-4 w-4" />
          Create your first form
        </span>
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="w-full justify-between h-10 font-medium text-base px-3"
        >
          <span className="truncate max-w-[180px]">
            {currentForm ? truncateUrl(currentForm.url) : "Select a form"}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        className="w-[var(--radix-dropdown-menu-trigger-width)]" 
        align="start"
      >
        <DropdownMenuLabel>Your Forms</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-[300px] overflow-y-auto">
          {forms.map((form) => (
            <DropdownMenuItem
              key={form.id}
              className={`cursor-pointer flex justify-between ${selectedFormId === form.id ? 'bg-accent' : ''}`}
              onClick={() => onFormSelect(form.id)}
            >
              <span className="truncate max-w-[180px]">{truncateUrl(form.url)}</span>
              {form.feedback?.[0]?.count !== undefined && (
                <span className="text-xs text-muted-foreground ml-2 tabular-nums">
                  {form.feedback[0].count}
                </span>
              )}
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
  )
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