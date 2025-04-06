import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Plus, Trash2, Edit, Save, X, AlertCircle } from 'lucide-react'
import { FeedbackTag } from '@/lib/types/feedback'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'
import { Label } from './ui/label'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface TagManagerProps {
  formId: string
  onTagsChange?: () => void
}

export function TagManager({ formId, onTagsChange }: TagManagerProps) {
  const [tags, setTags] = useState<FeedbackTag[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddTagDialog, setShowAddTagDialog] = useState(false)
  const [showEditTagDialog, setShowEditTagDialog] = useState(false)
  const [editingTag, setEditingTag] = useState<FeedbackTag | null>(null)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#3B82F6') // Default blue
  const [isGlobalTag, setIsGlobalTag] = useState(false)

  // Fetch tags
  useEffect(() => {
    const fetchTags = async () => {
      if (!formId) return
      
      setLoading(true)
      
      // Fetch both global tags and form-specific tags
      const { data, error } = await supabase
        .from('feedback_tags')
        .select('*')
        .or(`form_id.is.null,form_id.eq.${formId}`)
        .order('name')
      
      if (error) {
        console.error('Error fetching tags:', error)
        toast({
          title: 'Error fetching tags',
          description: error.message,
          variant: 'destructive'
        })
      } else {
        setTags(data || [])
      }
      
      setLoading(false)
    }
    
    fetchTags()
  }, [formId])

  // Add a new tag
  const addTag = async () => {
    if (!newTagName.trim()) {
      toast({
        title: 'Tag name is required',
        variant: 'destructive'
      })
      return
    }
    
    try {
      const { data, error } = await supabase
        .from('feedback_tags')
        .insert({
          name: newTagName.trim(),
          color: newTagColor,
          form_id: isGlobalTag ? null : formId
        })
        .select()
      
      if (error) throw error
      
      setTags(prevTags => [...prevTags, data[0]])
      setNewTagName('')
      setNewTagColor('#3B82F6')
      setIsGlobalTag(false)
      setShowAddTagDialog(false)
      
      if (onTagsChange) {
        onTagsChange()
      }
      
      toast({
        title: 'Tag created successfully',
        description: `The tag "${newTagName}" has been created.`
      })
    } catch (error: any) {
      console.error('Error adding tag:', error)
      
      let errorMessage = error.message
      
      // Handle unique constraint error in a user-friendly way
      if (error.code === '23505') {
        errorMessage = isGlobalTag 
          ? 'A global tag with this name already exists' 
          : 'A tag with this name already exists for this form'
      }
      
      toast({
        title: 'Failed to create tag',
        description: errorMessage,
        variant: 'destructive'
      })
    }
  }

  // Update an existing tag
  const updateTag = async () => {
    if (!editingTag || !newTagName.trim()) {
      toast({
        title: 'Tag name is required',
        variant: 'destructive'
      })
      return
    }
    
    try {
      const { error } = await supabase
        .from('feedback_tags')
        .update({
          name: newTagName.trim(),
          color: newTagColor
        })
        .eq('id', editingTag.id)
      
      if (error) throw error
      
      setTags(prevTags => prevTags.map(tag => 
        tag.id === editingTag.id 
          ? { ...tag, name: newTagName.trim(), color: newTagColor } 
          : tag
      ))
      setShowEditTagDialog(false)
      
      if (onTagsChange) {
        onTagsChange()
      }
      
      toast({
        title: 'Tag updated successfully',
        description: `The tag "${newTagName}" has been updated.`
      })
    } catch (error: any) {
      console.error('Error updating tag:', error)
      
      let errorMessage = error.message
      
      // Handle unique constraint error in a user-friendly way
      if (error.code === '23505') {
        errorMessage = editingTag.form_id === null
          ? 'A global tag with this name already exists' 
          : 'A tag with this name already exists for this form'
      }
      
      toast({
        title: 'Failed to update tag',
        description: errorMessage,
        variant: 'destructive'
      })
    }
  }

  // Delete a tag
  const deleteTag = async (tag: FeedbackTag) => {
    // Add confirmation
    if (!confirm(`Are you sure you want to delete the tag "${tag.name}"? This cannot be undone.`)) {
      return
    }
    
    try {
      const { error } = await supabase
        .from('feedback_tags')
        .delete()
        .eq('id', tag.id)
      
      if (error) throw error
      
      setTags(prevTags => prevTags.filter(t => t.id !== tag.id))
      
      if (onTagsChange) {
        onTagsChange()
      }
      
      toast({
        title: 'Tag deleted successfully',
        description: `The tag "${tag.name}" has been deleted.`
      })
    } catch (error: any) {
      console.error('Error deleting tag:', error)
      toast({
        title: 'Failed to delete tag',
        description: error.message,
        variant: 'destructive'
      })
    }
  }

  // Open edit dialog
  const openEditDialog = (tag: FeedbackTag) => {
    setEditingTag(tag)
    setNewTagName(tag.name)
    setNewTagColor(tag.color)
    setShowEditTagDialog(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-medium">Tags</h2>
        <Button 
          onClick={() => {
            setNewTagName('')
            setNewTagColor('#3B82F6')
            setIsGlobalTag(false)
            setShowAddTagDialog(true)
          }}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Tag
        </Button>
      </div>
      
      {loading ? (
        <div className="flex justify-center p-4">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : tags.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-6 text-center border rounded-lg bg-muted/20">
          <AlertCircle className="h-10 w-10 text-muted-foreground mb-2" />
          <h3 className="font-medium">No tags found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Create your first tag to categorize feedback.
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          {tags.map(tag => (
            <div 
              key={tag.id} 
              className="flex items-center justify-between p-3 border rounded-md group"
            >
              <div className="flex items-center gap-3">
                <div 
                  className="overflow-hidden max-w-[190px] rounded-md py-[3px] px-[6px] pl-[3px] font-medium cursor-pointer transition-colors"
                  style={{ 
                    userSelect: "none"
                  }}
                >
                  <div 
                    className="inline-flex items-center flex-shrink-1 min-w-0 max-w-full h-[20px] rounded-[3px] px-[6px] text-[12px] leading-[120%]"
                    style={{ 
                      backgroundColor: `${tag.color}20`,
                      color: `${tag.color}E0`
                    }}
                  >
                    <div className="whitespace-nowrap overflow-hidden text-ellipsis inline-flex items-center h-[20px] leading-[20px]">
                      <span className="whitespace-nowrap overflow-hidden text-ellipsis">{tag.name}</span>
                    </div>
                  </div>
                </div>
                {tag.form_id === null && (
                  <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                    Global
                  </span>
                )}
              </div>
              
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {tag.form_id !== null && (
                  <>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => openEditDialog(tag)}
                      className="h-8 w-8"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => deleteTag(tag)}
                      className="h-8 w-8 text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
                {tag.form_id === null && (
                  <div className="text-xs text-muted-foreground">
                    System tag (non-editable)
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Add Tag Dialog */}
      <Dialog open={showAddTagDialog} onOpenChange={setShowAddTagDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a new tag</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tag-name">Tag Name</Label>
              <Input 
                id="tag-name"
                value={newTagName}
                onChange={e => setNewTagName(e.target.value)}
                placeholder="e.g., High Priority"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="tag-color">Tag Color</Label>
              <div className="flex gap-2">
                <Input 
                  id="tag-color"
                  type="color"
                  value={newTagColor}
                  onChange={e => setNewTagColor(e.target.value)}
                  className="w-12 h-9 p-1"
                />
                <Input 
                  value={newTagColor}
                  onChange={e => setNewTagColor(e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is-global-tag"
                checked={isGlobalTag}
                onChange={e => setIsGlobalTag(e.target.checked)}
                className="rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Label htmlFor="is-global-tag" className="text-sm font-normal">
                Make this a global tag (available for all forms)
              </Label>
            </div>
            
            <div className="bg-muted/50 p-3 rounded-md text-sm">
              <p className="font-medium mb-1">Tag visibility:</p>
              <p className={cn(
                "text-muted-foreground",
                isGlobalTag ? "line-through opacity-50" : ""
              )}>
                • Form-specific tag: Only visible for this form's feedback
              </p>
              <p className={cn(
                "text-muted-foreground",
                !isGlobalTag ? "line-through opacity-50" : ""
              )}>
                • Global tag: Visible for all forms' feedback
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTagDialog(false)}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={addTag}>
              <Save className="h-4 w-4 mr-2" />
              Create Tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit Tag Dialog */}
      <Dialog open={showEditTagDialog} onOpenChange={setShowEditTagDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit tag</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-tag-name">Tag Name</Label>
              <Input 
                id="edit-tag-name"
                value={newTagName}
                onChange={e => setNewTagName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-tag-color">Tag Color</Label>
              <div className="flex gap-2">
                <Input 
                  id="edit-tag-color"
                  type="color"
                  value={newTagColor}
                  onChange={e => setNewTagColor(e.target.value)}
                  className="w-12 h-9 p-1"
                />
                <Input 
                  value={newTagColor}
                  onChange={e => setNewTagColor(e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditTagDialog(false)}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={updateTag}>
              <Save className="h-4 w-4 mr-2" />
              Update Tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
} 