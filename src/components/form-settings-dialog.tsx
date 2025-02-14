import { useState, useEffect } from 'react'
import { Palette, Trash2, Bell } from 'lucide-react'
import { areArraysEqual } from '@/lib/utils'
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
import { Switch } from './ui/switch'

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
  const [originalValues, setOriginalValues] = useState({
    styling: {
      buttonColor: '',
      supportText: ''
    },
    notifications: {
      enabled: false,
      emails: [] as { id: string; email: string }[],
      attributes: [] as string[]
    }
  })
  const [isDirty, setIsDirty] = useState({
    styling: false,
    notifications: {
      enabled: false,
      emails: false,
      attributes: false
    }
  })
  const [color, setColor] = useState(buttonColor)
  const [text, setText] = useState(supportText || '')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notifications, setNotifications] = useState<{ id: string; email: string }[]>([])
  const [notificationsSaving, setNotificationsSaving] = useState(false)
  const [enabledStateSaving, setEnabledStateSaving] = useState(false)
  const [emailsSaving, setEmailsSaving] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [newEmail, setNewEmail] = useState('')
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>(['message'])
  const [emailError, setEmailError] = useState('')
  const [pendingRemovals, setPendingRemovals] = useState<string[]>([])

  const NOTIFICATION_ATTRIBUTES = [
    { id: 'message', label: 'Message' },
    { id: 'user_id', label: 'User ID' },
    { id: 'user_email', label: 'User Email' },
    { id: 'user_name', label: 'User Name' },
    { id: 'operating_system', label: 'Operating System' },
    { id: 'screen_category', label: 'Device Category' },
    { id: 'image_url', label: 'Image URL' },
    { id: 'image_name', label: 'Image Name' },
    { id: 'created_at', label: 'Submission Date' }
  ]

  // Fetch notification settings
  useEffect(() => {
    if (open && formId) {
      const fetchSettings = async () => {
        const { data, error } = await supabase
        .from('notification_settings')
        .select('id, email, enabled, notification_attributes')
        .eq('form_id', formId)

        if (error) {
          console.error('Error fetching notification settings:', error)
          return
        }

        if (data) {
          setNotifications(data)
          // Check if any notifications are enabled
          setNotificationsEnabled(data.some(n => n.enabled))
          // Set selected attributes from first notification setting or default to ['message']
          if (data[0]?.notification_attributes) {
            setSelectedAttributes(data[0].notification_attributes)
          }
        }
      }

      fetchSettings()
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
    
    // Add to notifications state but don't save to database yet
    setNotifications(current => [...current, { id: `temp-${Date.now()}`, email: newEmail }])
    setNewEmail('')
  }

  const handleRemoveEmail = (id: string) => {
    setPendingRemovals(current => [...current, id])
    setNotifications(current => current.filter(n => n.id !== id))
  }

  const handleSaveEmails = async () => {
    setEmailsSaving(true)
    try {
      // Process removals first
      if (pendingRemovals.length > 0) {
        const { error: deleteError } = await supabase
          .from('notification_settings')
          .delete()
          .in('id', pendingRemovals.filter(id => !id.startsWith('temp-')))

        if (deleteError) throw deleteError
      }

      // Process additions
      const newEmails = notifications.filter(n => n.id.startsWith('temp-'))
      if (newEmails.length > 0) {
        const { error: insertError } = await supabase
          .from('notification_settings')
          .insert(
            newEmails.map(n => ({
              form_id: formId,
              email: n.email,
              enabled: notificationsEnabled,
              notification_attributes: selectedAttributes
            }))
          )

        if (insertError) throw insertError
      }

      // Refresh notifications list
      const { data: refreshedData } = await supabase
        .from('notification_settings')
        .select('id, email, enabled, notification_attributes')
        .eq('form_id', formId)

      if (refreshedData) {
        setNotifications(refreshedData)
      }

      // Reset change tracking
      setPendingRemovals([])
    } catch (error) {
      console.error('Error saving email changes:', error)
      setEmailError('Failed to save changes')
    } finally {
      setEmailsSaving(false)
    }
  }

  const handleSaveEnabledState = async () => {
    setEnabledStateSaving(true)
    try {
      const originalEnabled = originalValues.notifications.enabled
      const { error: updateError } = await supabase
        .from('notification_settings')
        .update({ enabled: notificationsEnabled })
        .eq('form_id', formId);

      if (updateError) throw updateError;
      
      setNotifications(current => 
        current.map(n => ({ ...n, enabled: notificationsEnabled }))
      );

      // Update original values and reset dirty state
      setOriginalValues(current => ({
        ...current,
        notifications: {
          ...current.notifications,
          enabled: notificationsEnabled
        }
      }))
      setIsDirty(current => ({
        ...current,
        notifications: {
          ...current.notifications,
          enabled: false
        }
      }))
    } catch (error) {
      console.error('Error updating notification settings:', error)
      setNotificationsEnabled(!notificationsEnabled)
    } finally {
      setEnabledStateSaving(false)
    }
  }

  const handleSaveNotificationContent = async () => {
    setNotificationsSaving(true)
    try {
      const originalAttributes = originalValues.notifications.attributes
      const { error: updateError } = await supabase
        .from('notification_settings')
        .update({ notification_attributes: selectedAttributes })
        .eq('form_id', formId);

      if (updateError) throw updateError;

      // Update original values and reset dirty state
      setOriginalValues(current => ({
        ...current,
        notifications: {
          ...current.notifications,
          attributes: selectedAttributes
        }
      }))
      setIsDirty(current => ({
        ...current,
        notifications: {
          ...current.notifications,
          attributes: false
        }
      }))
    } catch (error) {
      console.error('Error updating notification settings:', error)
    } finally {
      setNotificationsSaving(false)
    }
  }

  // Sync state with props when dialog opens
  useEffect(() => {
    if (open) {
      // Store initial values
      setOriginalValues({
        styling: {
          buttonColor,
          supportText: supportText || ''
        },
        notifications: {
          enabled: notificationsEnabled,
          emails: notifications,
          attributes: selectedAttributes
        }
      })
      // Reset dirty state
      setIsDirty({
        styling: false,
        notifications: {
          enabled: false,
          emails: false,
          attributes: false
        }
      })
      setColor(buttonColor)
      setText(supportText || '')
    }
  }, [open, buttonColor, supportText])

  // Track styling changes
  useEffect(() => {
    setIsDirty(current => ({
      ...current,
      styling: 
        color !== originalValues.styling.buttonColor ||
        text !== originalValues.styling.supportText
    }))
  }, [color, text, originalValues.styling])

  // Track notification changes
  useEffect(() => {
    setIsDirty(current => ({
      ...current,
      notifications: {
        enabled: notificationsEnabled !== originalValues.notifications.enabled,
        emails: !areArraysEqual(notifications, originalValues.notifications.emails),
        attributes: !areArraysEqual(selectedAttributes, originalValues.notifications.attributes)
      }
    }))
  }, [notificationsEnabled, notifications, selectedAttributes, originalValues.notifications])

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

      // Update original values after successful save
      setOriginalValues(current => ({
        ...current,
        styling: {
          buttonColor: color,
          supportText: text
        }
      }))
      // Reset dirty state for styling
      setIsDirty(current => ({
        ...current,
        styling: false
      }))
      
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
        <DialogContent className="max-w-[56rem]">
          <DialogHeader>
            <DialogTitle>Form Settings</DialogTitle>
          </DialogHeader>
          <div className="flex gap-6 h-[80vh] -mx-6 -mb-6">
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
                      )
                    </p>
                  </div>

                  <Button 
                    onClick={handleSave}
                    disabled={saving || !isDirty.styling}
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
                        <div className="flex items-center space-x-2 pt-2">
                          <Switch
                            checked={notificationsEnabled}
                            onCheckedChange={(checked) => setNotificationsEnabled(checked)}
                          />
                          <Label className="text-sm font-normal">
                            {notificationsEnabled ? 'Notifications enabled' : 'Notifications disabled'}
                          </Label>
                        </div>
                        <Button
                          onClick={handleSaveEnabledState}
                          disabled={enabledStateSaving || !isDirty.notifications.enabled}
                          className="mt-4"
                        >
                          {enabledStateSaving ? 'Saving...' : 'Save Changes'}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-4">
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
                    <Button
                      onClick={handleSaveEmails}
                      disabled={emailsSaving || !isDirty.notifications.emails}
                      className="mt-4"
                    >
                      {emailsSaving ? 'Saving...' : 'Save Changes'}
                    </Button>

                    <div className="space-y-4">
                      <h4 className="text-sm font-medium">Notification Content</h4>
                      <p className="text-sm text-muted-foreground">
                        Choose which information to include in notification emails:
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        {NOTIFICATION_ATTRIBUTES.map(attr => (
                          <div key={attr.id} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`attr-${attr.id}`}
                              checked={selectedAttributes.includes(attr.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedAttributes([...selectedAttributes, attr.id])
                                } else {
                                  setSelectedAttributes(
                                    selectedAttributes.filter(a => a !== attr.id)
                                  )
                                }
                              }}
                              className="h-4 w-4 rounded border-gray-300"
                            />
                            <label
                              htmlFor={`attr-${attr.id}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {attr.label}
                            </label>
                          </div>
                        ))}
                      </div>
                      
                      <Button
                        onClick={handleSaveNotificationContent}
                        disabled={notificationsSaving || !isDirty.notifications.attributes}
                        className="mt-4"
                      >
                        {notificationsSaving ? 'Saving...' : 'Save Changes'}
                      </Button>
                    </div>
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