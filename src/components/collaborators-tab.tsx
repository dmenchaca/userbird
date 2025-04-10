import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Check, X, Loader2, UserPlus, Shield, UserCircle } from 'lucide-react'
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Badge } from "./ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "./ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select"
import { supabase } from '@/lib/supabase'
import { isValidEmail } from '@/lib/utils'

interface Collaborator {
  id: string
  form_id: string
  user_id: string | null
  role: 'admin' | 'agent'
  invited_by: string
  invitation_email: string
  invitation_accepted: boolean
  created_at: string
  updated_at: string
  user?: {
    id: string
    email: string
  }
}

interface CollaboratorsTabProps {
  formId: string
}

export function CollaboratorsTab({ formId }: CollaboratorsTabProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'agent'>('agent')
  const [emailError, setEmailError] = useState('')
  const [inviting, setInviting] = useState(false)
  
  // Fetch collaborators
  useEffect(() => {
    async function fetchCollaborators() {
      try {
        setLoading(true)
        
        // Fetch collaborators directly from Supabase
        const { data, error } = await supabase
          .from('form_collaborators')
          .select(`
            id, 
            form_id, 
            user_id, 
            role, 
            invited_by, 
            invitation_email, 
            invitation_accepted,
            created_at,
            updated_at
          `)
          .eq('form_id', formId);
        
        if (error) {
          console.error('Error fetching collaborators:', error)
          toast.error('Failed to load collaborators')
          return
        }
        
        console.log('Fetched collaborators:', data)
        setCollaborators(data || [])
      } catch (error) {
        console.error('Error fetching collaborators:', error)
        toast.error('Failed to load collaborators')
      } finally {
        setLoading(false)
      }
    }
    
    fetchCollaborators()
  }, [formId])
  
  // Handle invite submission
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate email
    if (!inviteEmail.trim()) {
      setEmailError('Email is required')
      return
    }
    
    if (!isValidEmail(inviteEmail)) {
      setEmailError('Please enter a valid email')
      return
    }
    
    // Clear any previous errors
    setEmailError('')
    
    try {
      setInviting(true)
      
      // Normalize email address to lowercase for consistency
      const normalizedEmail = inviteEmail.trim().toLowerCase()
      
      // Find existing user by email using RPC (if they exist)
      const { data: existingUserId } = await supabase.rpc('get_user_id_by_email', {
        email_param: normalizedEmail
      })
      
      // Create collaborator record
      const { data, error } = await supabase
        .from('form_collaborators')
        .insert({
          form_id: formId,
          user_id: existingUserId || null,
          role: inviteRole,
          invitation_email: normalizedEmail, // Store normalized email
          invitation_accepted: !!existingUserId, // Auto-accepted if user exists
        })
        .select()
      
      if (error) {
        console.error('Error inviting collaborator:', error)
        throw new Error(error.message || 'Failed to invite user')
      }
      
      if (!data || data.length === 0) {
        throw new Error('Failed to create collaborator record')
      }
      
      const newCollaborator = data[0]
      
      // Add new collaborator to the list
      setCollaborators(prev => [...prev, newCollaborator as Collaborator])
      
      // Reset form
      setInviteEmail('')
      setInviteRole('agent')
      
      toast.success('Invitation sent successfully')
    } catch (error) {
      console.error('Error inviting collaborator:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to invite user')
      
      // Ensure any focused element is blurred to prevent aria-hidden issues
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
    } finally {
      setInviting(false)
    }
  }
  
  // Handle role change
  const handleRoleChange = async (collaboratorId: string, newRole: 'admin' | 'agent') => {
    try {
      // Update collaborator role directly in Supabase
      const { data, error } = await supabase
        .from('form_collaborators')
        .update({ 
          role: newRole,
          updated_at: new Date().toISOString()
        })
        .eq('id', collaboratorId)
        .eq('form_id', formId)
        .select();
      
      if (error) {
        console.error('Error updating role:', error)
        throw new Error(error.message || 'Failed to update role')
      }
      
      if (!data || data.length === 0) {
        throw new Error('Failed to update collaborator role')
      }
      
      const updatedCollaborator = data[0]
      
      // Update the collaborator in the list
      setCollaborators(prev => 
        prev.map(c => c.id === collaboratorId ? updatedCollaborator as Collaborator : c)
      )
      
      toast.success('Role updated successfully')
    } catch (error) {
      console.error('Error updating role:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update role')
    }
  }
  
  // Handle removing a collaborator
  const handleRemove = async (collaboratorId: string) => {
    if (!confirm('Are you sure you want to remove this collaborator?')) {
      return
    }
    
    try {
      // Delete collaborator directly from Supabase
      const { error } = await supabase
        .from('form_collaborators')
        .delete()
        .eq('id', collaboratorId)
        .eq('form_id', formId);
      
      if (error) {
        console.error('Error removing collaborator:', error)
        throw new Error(error.message || 'Failed to remove collaborator')
      }
      
      // Remove the collaborator from the list
      setCollaborators(prev => prev.filter(c => c.id !== collaboratorId))
      
      toast.success('Collaborator removed successfully')
    } catch (error) {
      console.error('Error removing collaborator:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to remove collaborator')
    }
  }
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Manage Collaborators</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Invite team members to collaborate on this form.
        </p>
      </div>
      
      <div className="border rounded-md p-4">
        <h4 className="text-sm font-medium mb-4">Invite New Collaborator</h4>
        <form onSubmit={handleInvite} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@example.com"
              className={emailError ? 'border-destructive' : ''}
            />
            {emailError && (
              <p className="text-xs text-destructive">{emailError}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select
              value={inviteRole}
              onValueChange={(value: string) => setInviteRole(value as 'admin' | 'agent')}
            >
              <SelectTrigger id="role">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    <span>Admin</span>
                  </div>
                </SelectItem>
                <SelectItem value="agent">
                  <div className="flex items-center gap-2">
                    <UserCircle className="h-4 w-4" />
                    <span>Agent</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              <strong>Admin:</strong> Can do everything including managing users and deleting
              <br />
              <strong>Agent:</strong> Can view and update form settings and feedback
            </p>
          </div>
          
          <Button type="submit" disabled={inviting}>
            {inviting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Inviting...
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Send Invitation
              </>
            )}
          </Button>
        </form>
      </div>
      
      <div className="border rounded-md p-4">
        <h4 className="text-sm font-medium mb-4">Current Collaborators</h4>
        
        {loading ? (
          <div className="flex justify-center items-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : collaborators.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No collaborators yet. Invite people to collaborate on this form.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {collaborators.map((collaborator) => (
                <TableRow key={collaborator.id}>
                  <TableCell className="font-medium">
                    {collaborator.user?.email || collaborator.invitation_email}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={collaborator.role}
                      onValueChange={(value: string) => handleRoleChange(collaborator.id, value as 'admin' | 'agent')}
                    >
                      <SelectTrigger className="h-8 w-28">
                        <SelectValue>
                          <span className="flex items-center gap-1.5">
                            {collaborator.role === 'admin' ? (
                              <Shield className="h-3.5 w-3.5" />
                            ) : (
                              <UserCircle className="h-3.5 w-3.5" />
                            )}
                            {collaborator.role === 'admin' ? 'Admin' : 'Agent'}
                          </span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            <span>Admin</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="agent">
                          <div className="flex items-center gap-2">
                            <UserCircle className="h-4 w-4" />
                            <span>Agent</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {collaborator.invitation_accepted ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        <Check className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                        Pending
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(collaborator.id)}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                      <span className="sr-only">Remove</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
} 