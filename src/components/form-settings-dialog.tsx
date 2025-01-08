import { useState, useEffect } from 'react'
import { Palette, Trash2, Bell, ToggleLeft, ToggleRight } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { cache } from '@/lib/cache'
import { DeleteFormDialog } from './delete-form-dialog'

interface FormSettingsDialogProps {
  formId: string
  formUrl: string
  buttonColor: string
  supportText: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSettingsSaved: () => void
  onDelete: () => void
}

type SettingsTab = 'styling' | 'notifications' | 'delete'

export function FormSettingsDialog({ 
  formId, 
  formUrl,
  buttonColor,
  supportText,
  open, 
  onOpenChange,
  onSettingsSaved,
  onDelete
}: FormSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('styling')
  const [color, setColor] = useState(buttonColor)
  const [text, setText] = useState(supportText || '')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notifications, setNotifications] = useState<{ id: string; email: string }[]>([])
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [newEmail, setNewEmail] = useState('')
  const [emailError, setEmailError] = useState('')

  // Fetch notification settings
  useEffect(() => {
    if (open && formId) {
      supabase
        .from('notification_settings')
        .select('id, email, enabled')
        .eq('form_id', formId)
        .then(({ data }) => {
          if (data) {
            setNotifications(data)
            // Check if any notifications are enabled
            setNotificationsEnabled(data.some(n => n.enabled))
          }
        })
    }
  }, [open, formId])

  const handleAddEmail = async () => {
    setEmailError('')
    
    if (!newEmail.trim()) {
      setEmailError('Email is required')
      return
    }
    
    if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(newEmail)) {
      setEmailError('Invalid email address')
      return
    }
    
    try {
      const { data, error } = await supabase
        .from('notification_settings')
        .insert([
          { form_id: formId, email: newEmail, enabled: notificationsEnabled }
        ])
        .select()
        .single()

      if (error) throw error
      
      if (data) {
        setNotifications([...notifications, data])
        setNewEmail('')
      }
    } catch (error) {
      console.error('Error adding email:', error)
      setEmailError('Failed to add email')
    }
  }

  const handleRemoveEmail = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notification_settings')
        .delete()
        .eq('id', id)

      if (error) throw error
      
      setNotifications(notifications.filter(n => n.id !== id))
    } catch (error) {
      console.error('Error removing email:', error)
    }
  }

  const handleToggleNotifications = async () => {
    const newState = !notificationsEnabled
    setNotificationsEnabled(newState)
    
    try {
      const { error } = await supabase
        .from('notification_settings')
        .update({ enabled: newState })
        .eq('form_id', formId)

      if (error) throw error
      
      // Update local state
      setNotifications(notifications.map(n => ({ ...n, enabled: newState })))
    } catch (error) {
      console.error('Error updating notification settings:', error)
      // Revert state on error
      setNotificationsEnabled(!newState)
    }
  }

  // Sync state with props when dialog opens
  useEffect(() => {
    if (open) {
      setColor(buttonColor)
      setText(supportText || '')
    }
  }, [open, buttonColor, supportText])

  useEffect(() => {
    setColor(buttonColor)
    setText(supportText || '')
  }, [buttonColor, supportText, open])

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('forms')
        .update({ 
          button_color: color,
          support_text: text || null
        })
        .eq('id', formId)

      if (error) throw error;
      
      // Invalidate cache when settings are updated
      cache.invalidate(`form-settings:${formId}`);
      
      onSettingsSaved();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating form:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Form Settings</DialogTitle>
          </DialogHeader>
          <div className="flex gap-6 h-[400px] -mx-6 -mb-6">
            <div className="w-48 border-r">
              <div className="px-2 py-2 space-y-1">
                <button
                  onClick={() => setActiveTab('styling')}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                    activeTab === 'styling' ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Palette className="w-4 h-4" />
                  Styling
                </button>
                <button
                  onClick={() => setActiveTab('notifications')}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                    activeTab === 'notifications' ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Bell className="w-4 h-4" />
                  Notifications
                </button>
                <button
                  onClick={() => setActiveTab('delete')}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                    activeTab === 'delete' ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto px-6">
              {activeTab === 'styling' && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="buttonColor">Button Color</Label>
                    <div className="flex gap-2">
                      <Input
                        id="buttonColor"
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="w-20"
                      />
                      <Input
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        placeholder="#1f2937"
                        pattern="^#[0-9a-fA-F]{6}$"
                        className="font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="supportText">Support Text (optional)</Label>
                    <Input
                      id="supportText"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Have a specific issue? [Contact support](https://example.com) or [read our docs](https://docs.example.com)"
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      Add optional support text with markdown links. Example: [Link text](https://example.com)
                    </p>
                  </div>

                  <Button 
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              )}

              {activeTab === 'notifications' && (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label>Email Notifications</Label>
                        <p className="text-sm text-muted-foreground">
                          Add email addresses to receive notifications when new feedback is submitted.
                        </p>
                      </div>
                      <button
                        onClick={handleToggleNotifications}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {notificationsEnabled ? (
                          <ToggleRight className="w-8 h-8 text-primary" />
                        ) : (
                          <ToggleLeft className="w-8 h-8" />
                        )}
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input
                          value={newEmail}
                          onChange={(e) => {
                            setNewEmail(e.target.value)
                            setEmailError('')
                          }}
                          placeholder="email@example.com"
                          className={emailError ? 'border-destructive' : ''}
                        />
                        <Button onClick={handleAddEmail}>
                          Add Email
                        </Button>
                      </div>
                      {emailError && (
                        <p className="text-sm text-destructive">{emailError}</p>
                      )}
                    </div>

                    {notifications.length > 0 ? (
                      <div className="space-y-2">
                        {notifications.map((notification) => (
                          <div 
                            key={notification.id}
                            className="flex items-center justify-between p-2 rounded-md bg-muted"
                          >
                            <span className="text-sm">{notification.email}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveEmail(notification.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {notificationsEnabled 
                          ? "No notification emails added yet."
                          : "Notifications are currently disabled."
                        }
                      </p>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'delete' && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
                    <h3 className="text-sm font-medium text-destructive mb-2">Delete Form</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      This action cannot be undone. This will permanently delete the form
                      and all of its feedback.
                    </p>
                    <Button
                      variant="destructive"
                      onClick={() => setShowDeleteDialog(true)}
                    >
                      Delete Form
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteFormDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={() => {
          onDelete()
          onOpenChange(false)
        }}
        formUrl={formUrl}
      />
    </>
  )
}