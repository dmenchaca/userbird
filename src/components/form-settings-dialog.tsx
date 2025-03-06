import { useState, useEffect } from 'react'
import { Palette, Trash2, Bell, X } from 'lucide-react'
import { areArraysEqual, isValidUrl, isValidEmail } from '@/lib/utils'
import { toast } from 'sonner'
import debounce from 'lodash.debounce'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
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
      supportText: '',
      url: ''
    },
    notifications: {
      enabled: false,
      emails: [] as { id: string; email: string }[],
      attributes: [] as string[]
    }
  })
  const [color, setColor] = useState(buttonColor)
  const [text, setText] = useState(supportText || '')
  const [url, setUrl] = useState(formUrl)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [notifications, setNotifications] = useState<{ id: string; email: string }[]>([])
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [newEmail, setNewEmail] = useState('')
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>(['message'])
  const [emailError, setEmailError] = useState('')
  const [isInitialMount, setIsInitialMount] = useState(true)

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

  // Initialize original values
  useEffect(() => {
    setOriginalValues(current => ({
      ...current,
      styling: {
        buttonColor,
        supportText: supportText || '',
        url: formUrl
      }
    }))
    setIsInitialMount(false)
  }, [buttonColor, supportText, formUrl])

  // Auto-save color changes
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (!isInitialMount && color !== originalValues.styling.buttonColor) {
      console.log('Color changed:', { 
        newColor: color, 
        originalColor: originalValues.styling.buttonColor 
      });

      timeoutId = setTimeout(async () => {
        console.log('Starting color update...');
        try {
          const { error } = await supabase
            .from('forms')
            .update({ button_color: color })
            .eq('id', formId);

          if (error) throw error;
          
          console.log('Color update successful');
          
          setOriginalValues(current => ({
            ...current,
            styling: {
              ...current.styling,
              buttonColor: color
            }
          }));
          
          cache.invalidate(`form-settings:${formId}`);
          onSettingsSaved();
          
          toast.success('Button color updated successfully');
        } catch (error) {
          console.error('Error updating button color:', error);
          setColor(originalValues.styling.buttonColor);
          toast.error('Failed to update button color');
        }
      }, 500);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [color, formId, originalValues.styling.buttonColor, onSettingsSaved, isInitialMount]);

  // Auto-save support text changes
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (!isInitialMount && text !== originalValues.styling.supportText) {
      console.log('Support text changed:', {
        newText: text,
        originalText: originalValues.styling.supportText
      });

      timeoutId = setTimeout(async () => {
        console.log('Starting support text update...');
        try {
          const { error } = await supabase
            .from('forms')
            .update({ support_text: text || null })
            .eq('id', formId);

          if (error) throw error;

          console.log('Support text update successful');

          setOriginalValues(current => ({
            ...current,
            styling: {
              ...current.styling,
              supportText: text
            }
          }));

          cache.invalidate(`form-settings:${formId}`);
          onSettingsSaved();

          toast.success('Support text updated successfully');
        } catch (error) {
          console.error('Error updating support text:', error);
          setText(originalValues.styling.supportText);
          toast.error('Failed to update support text');
        }
      }, 500);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [text, formId, originalValues.styling.supportText, onSettingsSaved, isInitialMount]);

  // Auto-save URL changes
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (!isInitialMount && url !== originalValues.styling.url) {
      console.log('URL changed:', {
        newUrl: url,
        originalUrl: originalValues.styling.url
      });

      timeoutId = setTimeout(async () => {
        // Validate URL first
        if (!isValidUrl(url)) {
          console.log('Invalid URL, reverting...');
          setUrl(originalValues.styling.url);
          toast.error('Please enter a valid URL');
          return;
        }

        console.log('Starting URL update...');
        try {
          const { error } = await supabase
            .from('forms')
            .update({ url })
            .eq('id', formId);

          if (error) throw error;

          console.log('URL update successful');

          setOriginalValues(current => ({
            ...current,
            styling: {
              ...current.styling,
              url
            }
          }));

          cache.invalidate(`form-settings:${formId}`);
          onSettingsSaved();

          toast.success('Website URL updated successfully');
        } catch (error) {
          console.error('Error updating URL:', error);
          setUrl(originalValues.styling.url);
          toast.error('Failed to update website URL');
        }
      }, 500);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [url, formId, originalValues.styling.url, onSettingsSaved, isInitialMount]);

  // Auto-save notification enabled state
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (!isInitialMount && 
        notificationsEnabled !== originalValues.notifications.enabled && 
        originalValues.notifications.emails.length > 0) {
      console.log('Notifications enabled state changed:', {
        newState: notificationsEnabled,
        originalState: originalValues.notifications.enabled,
        isInitialMount
      });

      timeoutId = setTimeout(async () => {
        console.log('Starting notifications enabled state update...');
        try {
          const { error } = await supabase
            .from('notification_settings')
            .update({ enabled: notificationsEnabled })
            .eq('form_id', formId);

          if (error) throw error;

          setNotifications(current => 
            current.map(n => ({ ...n, enabled: notificationsEnabled }))
          );

          setOriginalValues(current => ({
            ...current,
            notifications: {
              ...current.notifications,
              enabled: notificationsEnabled,
              emails: current.notifications.emails.map(n => ({
                ...n,
                enabled: notificationsEnabled
              }))
            }
          }));

          console.log('Notifications enabled state update successful');
          
          toast.success(
            notificationsEnabled 
              ? 'Notifications enabled successfully' 
              : 'Notifications disabled successfully'
          );

        } catch (error) {
          console.error('Error updating notifications state:', error);
          setNotificationsEnabled(originalValues.notifications.enabled);
          toast.error('Failed to update notification settings');
        }
      }, 500);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [notificationsEnabled, formId, originalValues.notifications.enabled, isInitialMount, originalValues.notifications.emails.length]);

  // Auto-save notification attributes
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (!isInitialMount && 
        !areArraysEqual(selectedAttributes, originalValues.notifications.attributes) &&
        originalValues.notifications.attributes.length > 0) {
      
      console.log('Notification attributes changed:', {
        newAttributes: selectedAttributes,
        originalAttributes: originalValues.notifications.attributes,
        isInitialMount
      });

      timeoutId = setTimeout(async () => {
        console.log('Starting notification attributes update...');
        try {
          const { error } = await supabase
            .from('notification_settings')
            .update({ notification_attributes: selectedAttributes })
            .eq('form_id', formId);

          if (error) throw error;

          console.log('Notification attributes update successful');

          setOriginalValues(current => ({
            ...current,
            notifications: {
              ...current.notifications,
              attributes: selectedAttributes
            }
          }));

          toast.success('Notification content settings updated successfully');

        } catch (error) {
          console.error('Error updating notification attributes:', error);
          setSelectedAttributes(originalValues.notifications.attributes);
          toast.error('Failed to update notification content settings');
        }
      }, 500);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [selectedAttributes, formId, originalValues.notifications.attributes, isInitialMount]);

  // Fetch notification settings
  useEffect(() => {
    let mounted = true;

    if (open && formId) {
      console.log('Fetching notification settings...');
      const fetchSettings = async () => {
        setIsInitialMount(true); // Set initial mount before fetching

        const { data, error } = await supabase
          .from('notification_settings')
          .select('id, email, enabled, notification_attributes')
          .eq('form_id', formId);

        if (!mounted) return;

        if (error) {
          console.error('Error fetching notification settings:', error);
          setIsInitialMount(false);
          return;
        }

        if (data) {
          // Get the enabled state from the first notification setting
          // If no settings exist, default to false
          const isEnabled = data.length > 0 ? data[0].enabled : false;
          
          // Set all values in a batch
          const updates = () => {
            setNotifications(data);
            setNotificationsEnabled(isEnabled);
            if (data[0]?.notification_attributes) {
              setSelectedAttributes(data[0].notification_attributes);
            }
            setOriginalValues(current => ({
              ...current,
              notifications: {
                enabled: isEnabled,
                emails: data,
                attributes: data[0]?.notification_attributes || ['message']
              }
            }));
          };

          // Batch the updates
          updates();

          // Reset isInitialMount after all state updates are complete
          requestAnimationFrame(() => {
            if (mounted) {
              setIsInitialMount(false);
            }
          });
        } else {
          // If no data exists, set defaults
          setNotificationsEnabled(false);
          setOriginalValues(current => ({
            ...current,
            notifications: {
              enabled: false,
              emails: [],
              attributes: ['message']
            }
          }));
          setIsInitialMount(false);
        }
      };

      fetchSettings();
    }

    return () => {
      mounted = false;
    };
  }, [open, formId]);

  const handleAddEmail = async () => {
    setEmailError('');
    
    if (!newEmail.trim()) {
      setEmailError('Email is required');
      return;
    }
    
    if (!isValidEmail(newEmail)) {
      setEmailError('Invalid email address');
      return;
    }

    try {
      const { error, data } = await supabase
        .from('notification_settings')
        .insert({
          form_id: formId,
          email: newEmail,
          enabled: notificationsEnabled,
          notification_attributes: selectedAttributes
        })
        .select()
        .single();

      if (error) throw error;

      setNotifications(current => [...current, data]);
      setNewEmail('');
      toast.success('Email added successfully');
    } catch (error) {
      console.error('Error adding email:', error);
      setEmailError('Failed to add email');
      toast.error('Failed to add email');
    }
  };

  const handleRemoveEmail = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notification_settings')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setNotifications(current => current.filter(n => n.id !== id));
      toast.success('Email removed successfully');
    } catch (error) {
      console.error('Error removing email:', error);
      toast.error('Failed to remove email');
    }
  };

  const handleTabSwitch = (newTab: SettingsTab) => {
    setActiveTab(newTab);
  };

  const handleDialogClose = () => {
    onOpenChange(false);
  };

  useEffect(() => {
    setColor(buttonColor);
    setText(supportText || '');
    setUrl(formUrl);
  }, [buttonColor, supportText, formUrl, open]);

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-[56rem]">
          <DialogHeader>
            <DialogTitle>Form Settings</DialogTitle>
            <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </DialogHeader>
          <div className="flex gap-6 h-[80vh] -mx-6 -mb-6">
            <div className="w-48 border-r">
              <div className="px-2 py-2 space-y-1">
                <button
                  onClick={() => handleTabSwitch('styling')}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                    activeTab === 'styling' ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Palette className="w-4 h-4" />
                  Styling
                </button>
                <button
                  onClick={() => handleTabSwitch('notifications')}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                    activeTab === 'notifications' ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Bell className="w-4 h-4" />
                  Notifications
                </button>
                <button
                  onClick={() => handleTabSwitch('delete')}
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
                    <Label htmlFor="url">Website URL</Label>
                    <div className="flex gap-2">
                      <span className="flex items-center text-sm text-muted-foreground">https://</span>
                      <Input
                        id="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="app.userbird.co"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      The domain where your widget is installed
                    </p>
                  </div>

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
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex gap-2">
                        <Input
                          value={newEmail}
                          onChange={(e) => {
                            setNewEmail(e.target.value);
                            setEmailError('');
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

                    <div>
                      <h4 className="text-sm font-medium">Notification Content</h4>
                      <p className="text-sm text-muted-foreground mt-2">
                        Choose which information to include in notification emails:
                      </p>
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        {NOTIFICATION_ATTRIBUTES.map(attr => (
                          <div key={attr.id} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`attr-${attr.id}`}
                              checked={selectedAttributes.includes(attr.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedAttributes([...selectedAttributes, attr.id]);
                                } else {
                                  setSelectedAttributes(
                                    selectedAttributes.filter(a => a !== attr.id)
                                  );
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
          onDelete();
          onOpenChange(false);
        }}
        formUrl={formUrl}
      />
    </>
  );
}