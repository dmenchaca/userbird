import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Plus, Trash2, Edit, Save, X, AlertCircle, Star, Check, ChevronDown } from 'lucide-react'
import { FeedbackTag } from '@/lib/types/feedback'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'
import { Label } from './ui/label'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'

interface TagManagerProps {
  formId: string
  onTagsChange?: () => void
}

// Color options array
const colorOptions = [
  { 
    name: 'Gray', 
    value: '#64748B',
    background: '#64748B25',
    text: '#334155'
  },
  { 
    name: 'Brown', 
    value: '#78716C',
    background: '#78716C25',
    text: '#44403C'
  },
  { 
    name: 'Orange', 
    value: '#F97316',
    background: '#F9731625',
    text: '#C2410C'
  },
  { 
    name: 'Yellow', 
    value: '#EAB308',
    background: '#EAB30825',
    text: '#854D0E'
  },
  { 
    name: 'Green', 
    value: '#10B981',
    background: '#10B98125',
    text: '#047857'
  },
  { 
    name: 'Blue', 
    value: '#3B82F6',
    background: '#3B82F625',
    text: '#1D4ED8'
  },
  { 
    name: 'Purple', 
    value: '#8B5CF6',
    background: '#8B5CF625',
    text: '#6D28D9'
  },
  { 
    name: 'Pink', 
    value: '#EC4899',
    background: '#EC489925',
    text: '#BE185D'
  },
  { 
    name: 'Red', 
    value: '#EF4444',
    background: '#EF444425',
    text: '#B91C1C'
  }
]

export function TagManager({ formId, onTagsChange }: TagManagerProps) {
  const [tags, setTags] = useState<FeedbackTag[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddTagDialog, setShowAddTagDialog] = useState(false)
  const [showEditTagDialog, setShowEditTagDialog] = useState(false)
  const [editingTag, setEditingTag] = useState<FeedbackTag | null>(null)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#3B82F6') // Default blue
  const [isFavoriteTag, setIsFavoriteTag] = useState(false)

  // Fetch tags
  useEffect(() => {
    const fetchTags = async () => {
      if (!formId) return
      
      setLoading(true)
      
      // Fetch only form-specific tags
      const { data, error } = await supabase
        .from('feedback_tags')
        .select('*')
        .eq('form_id', formId)
        .order('name')
      
      if (error) {
        console.error('Error fetching tags:', error)
        toast.error(error.message)
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
      toast.error('Tag name is required')
      return
    }
    
    try {
      const { data, error } = await supabase
        .from('feedback_tags')
        .insert({
          name: newTagName.trim(),
          color: newTagColor,
          form_id: formId,
          is_favorite: isFavoriteTag
        })
        .select()
      
      if (error) throw error
      
      setTags(prevTags => [...prevTags, data[0]])
      setNewTagName('')
      setNewTagColor('#3B82F6')
      setIsFavoriteTag(false)
      setShowAddTagDialog(false)
      
      if (onTagsChange) {
        onTagsChange()
      }
      
      toast.success(`The tag "${newTagName}" has been created.`)
    } catch (error: any) {
      console.error('Error adding tag:', error)
      
      let errorMessage = error.message
      
      // Handle unique constraint error in a user-friendly way
      if (error.code === '23505') {
        errorMessage = 'A tag with this name already exists for this form'
      }
      
      toast.error(errorMessage)
    }
  }

  // Update an existing tag
  const updateTag = async () => {
    if (!editingTag || !newTagName.trim()) {
      toast.error('Tag name is required')
      return
    }
    
    try {
      const { error } = await supabase
        .from('feedback_tags')
        .update({
          name: newTagName.trim(),
          color: newTagColor,
          is_favorite: isFavoriteTag
        })
        .eq('id', editingTag.id)
      
      if (error) throw error
      
      setTags(prevTags => prevTags.map(tag => 
        tag.id === editingTag.id 
          ? { ...tag, name: newTagName.trim(), color: newTagColor, is_favorite: isFavoriteTag } 
          : tag
      ))
      setShowEditTagDialog(false)
      
      if (onTagsChange) {
        onTagsChange()
      }
      
      toast.success(`The tag "${newTagName}" has been updated.`)
    } catch (error: any) {
      console.error('Error updating tag:', error)
      
      let errorMessage = error.message
      
      // Handle unique constraint error in a user-friendly way
      if (error.code === '23505') {
        errorMessage = 'A tag with this name already exists for this form'
      }
      
      toast.error(errorMessage)
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
      
      toast.success(`The tag "${tag.name}" has been deleted.`)
    } catch (error: any) {
      console.error('Error deleting tag:', error)
      toast.error(error.message)
    }
  }

  // Toggle favorite status
  const toggleFavorite = async (tag: FeedbackTag) => {
    try {
      const newFavoriteStatus = !tag.is_favorite
      
      const { error } = await supabase
        .from('feedback_tags')
        .update({
          is_favorite: newFavoriteStatus
        })
        .eq('id', tag.id)
      
      if (error) throw error
      
      setTags(prevTags => prevTags.map(t => 
        t.id === tag.id 
          ? { ...t, is_favorite: newFavoriteStatus } 
          : t
      ))
      
      if (onTagsChange) {
        onTagsChange()
      }
      
      if (newFavoriteStatus) {
        toast.success(`"${tag.name}" added to favorites`)
      } else {
        toast.success(`"${tag.name}" removed from favorites`)
      }
    } catch (error: any) {
      console.error('Error updating favorite status:', error)
      toast.error(error.message)
    }
  }

  // Open edit dialog
  const openEditDialog = (tag: FeedbackTag) => {
    setEditingTag(tag)
    setNewTagName(tag.name)
    setNewTagColor(tag.color)
    setIsFavoriteTag(tag.is_favorite)
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
            setIsFavoriteTag(false)
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
                {tag.is_favorite && (
                  <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-600 rounded-full flex items-center">
                    <Star className="h-3 w-3 mr-1 fill-amber-500" />
                    Favorite
                  </span>
                )}
              </div>
              
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => toggleFavorite(tag)}
                  className={cn("h-8 w-8", tag.is_favorite ? "text-amber-500" : "")}
                  aria-label={tag.is_favorite ? "Remove from favorites" : "Add to favorites"}
                >
                  <Star className={cn("h-4 w-4", tag.is_favorite ? "fill-amber-500" : "")} />
                </Button>
                
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
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                  >
                    <div className="flex items-center">
                      <div
                        className="w-4 h-4 rounded border"
                        style={{ 
                          backgroundColor: `${newTagColor}30`,
                          borderColor: `${newTagColor}70`
                        }}
                      />
                      <span className="ml-2 text-sm text-foreground">
                        {colorOptions.find(c => c.value === newTagColor)?.name || 'Select color'}
                      </span>
                    </div>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-48 p-0" 
                  align="start"
                  sideOffset={5}
                  style={{ zIndex: 9999 }}
                >
                  <div className="flex flex-col py-1">
                    {colorOptions.map(color => (
                      <button
                        key={color.value}
                        type="button"
                        onClick={() => {
                          setNewTagColor(color.value)
                        }}
                        className={cn(
                          "flex items-center gap-2 w-full px-3 py-1.5 hover:bg-accent text-left cursor-pointer",
                          newTagColor === color.value && "bg-accent"
                        )}
                      >
                        <div 
                          className="w-5 h-5 rounded border" 
                          style={{ 
                            backgroundColor: `${color.value}30`,
                            borderColor: `${color.value}70`
                          }}
                        />
                        <span className="text-sm text-foreground">{color.name}</span>
                        {newTagColor === color.value && (
                          <Check className="h-4 w-4 ml-auto" />
                        )}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is-favorite-tag"
                checked={isFavoriteTag}
                onChange={e => setIsFavoriteTag(e.target.checked)}
                className="rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Label htmlFor="is-favorite-tag" className="text-sm font-normal flex items-center">
                Add to favorites <Star className="h-3 w-3 ml-1 text-amber-500" />
              </Label>
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
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                  >
                    <div className="flex items-center">
                      <div
                        className="w-4 h-4 rounded border"
                        style={{ 
                          backgroundColor: `${newTagColor}30`,
                          borderColor: `${newTagColor}70`
                        }}
                      />
                      <span className="ml-2 text-sm text-foreground">
                        {colorOptions.find(c => c.value === newTagColor)?.name || 'Select color'}
                      </span>
                    </div>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-48 p-0" 
                  align="start"
                  sideOffset={5}
                  style={{ zIndex: 9999 }}
                >
                  <div className="flex flex-col py-1">
                    {colorOptions.map(color => (
                      <button
                        key={color.value}
                        type="button"
                        onClick={() => {
                          setNewTagColor(color.value)
                        }}
                        className={cn(
                          "flex items-center gap-2 w-full px-3 py-1.5 hover:bg-accent text-left cursor-pointer",
                          newTagColor === color.value && "bg-accent"
                        )}
                      >
                        <div 
                          className="w-5 h-5 rounded border" 
                          style={{ 
                            backgroundColor: `${color.value}30`,
                            borderColor: `${color.value}70`
                          }}
                        />
                        <span className="text-sm text-foreground">{color.name}</span>
                        {newTagColor === color.value && (
                          <Check className="h-4 w-4 ml-auto" />
                        )}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-is-favorite"
                checked={isFavoriteTag}
                onChange={e => setIsFavoriteTag(e.target.checked)}
                className="rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Label htmlFor="edit-is-favorite" className="text-sm font-normal flex items-center">
                Add to favorites <Star className="h-3 w-3 ml-1 text-amber-500" />
              </Label>
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