import { useState, useEffect } from 'react'
import { Palette, Trash2, Bell, X, Webhook, Tag } from 'lucide-react'
import { areArraysEqual, isValidUrl, isValidEmail, isValidHexColor } from '@/lib/utils'
import { toast } from 'sonner'
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
import { Textarea } from './ui/textarea'

// Helper function to get the Supabase token
const getSupabaseToken = async () => {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || '';
};

interface CustomEmailSettings {
  id?: string;
  custom_email: string;
  verified: boolean;
  form_id: string;
}

interface FormSettingsDialogProps {
  formId: string
  formUrl: string
  buttonColor: string
  supportText: string | null
  keyboardShortcut: string | null
  soundEnabled: boolean
  showGifOnSuccess: boolean
  removeBranding: boolean
  initialGifUrls?: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSettingsSaved: () => void
  onDelete: () => void
  children?: React.ReactNode
}

type SettingsTab = 'styling' | 'notifications' | 'webhooks' | 'tags' | 'delete' | 'email'

export function FormSettingsDialog({ 
  formId, 
  formUrl,
  buttonColor,
  supportText,
  keyboardShortcut,
  soundEnabled: initialSoundEnabled,
  showGifOnSuccess: initialShowGifOnSuccess,
  removeBranding: initialRemoveBranding,
  initialGifUrls = [],
  open, 
  onOpenChange,
  onSettingsSaved,
  onDelete,
  children
}: FormSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('styling')
  const [originalValues, setOriginalValues] = useState({
    styling: {
      buttonColor: '',
      supportText: '',
      url: '',
      keyboardShortcut: '',
      soundEnabled: false,
      showGifOnSuccess: false,
      removeBranding: false,
      gifUrls: [] as string[]
    },
    notifications: {
      enabled: false,
      emails: [] as { id: string; email: string }[],
      attributes: [] as string[]
    },
    webhooks: {
      enabled: false,
      url: ''
    }
  })
  const [color, setColor] = useState(buttonColor)
  const [text, setText] = useState(supportText || '')
  const [url, setUrl] = useState(formUrl)
  const [shortcut, setShortcut] = useState(keyboardShortcut || '')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [notifications, setNotifications] = useState<{ id: string; email: string }[]>([])
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [newEmail, setNewEmail] = useState('')
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>(['message'])
  const [emailError, setEmailError] = useState('')
  const [isInitialMount, setIsInitialMount] = useState(true)
  const [webhookEnabled, setWebhookEnabled] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [soundEnabled, setSoundEnabled] = useState(initialSoundEnabled)
  const [showGifOnSuccess, setShowGifOnSuccess] = useState(initialShowGifOnSuccess)
  const [removeBranding, setRemoveBranding] = useState(initialRemoveBranding)
  const [gifUrls, setGifUrls] = useState<string[]>(initialGifUrls)
  const [gifUrlsText, setGifUrlsText] = useState(initialGifUrls.join('\n'))

  // Custom email states
  const [customEmail, setCustomEmail] = useState('');
  const [customEmailStatus, setCustomEmailStatus] = useState<'unverified' | 'verified' | 'none'>('none');
  const [isVerificationSent, setIsVerificationSent] = useState(false);
  const [customEmailId, setCustomEmailId] = useState<string | null>(null);
  const [customEmailError, setCustomEmailError] = useState('');
  const [senderName, setSenderName] = useState('');
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);

  const NOTIFICATION_ATTRIBUTES = [
    { id: 'message', label: 'Message' },
    { id: 'user_id', label: 'User ID' },
    { id: 'user_email', label: 'User Email' },
    { id: 'user_name', label: 'User Name' },
    { id: 'url_path', label: 'Page URL' },
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
        ...current.styling,
        buttonColor,
        supportText: supportText || '',
        url: formUrl,
        keyboardShortcut: keyboardShortcut || '',
        soundEnabled: initialSoundEnabled,
        showGifOnSuccess: initialShowGifOnSuccess,
        removeBranding: initialRemoveBranding,
        gifUrls: initialGifUrls
      },
      webhooks: current.webhooks
    }))
    setIsInitialMount(false)
  }, [buttonColor, supportText, formUrl, keyboardShortcut, initialSoundEnabled, initialShowGifOnSuccess, initialRemoveBranding, initialGifUrls])

  // Initialize gifUrls and gifUrlsText
  useEffect(() => {
    setGifUrls(initialGifUrls);
    setGifUrlsText(initialGifUrls.join('\n'));
  }, [initialGifUrls]);

  // Fetch webhook settings
  useEffect(() => {
    let mounted = true;

    if (open && formId) {
      const fetchWebhookSettings = async () => {
        try {
          const { data, error } = await supabase
            .from('webhook_settings')
            .select('enabled, url')
            .eq('form_id', formId)
            .single();

          if (!mounted) return;

          if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
            console.error('Error fetching webhook settings:', error);
            return;
          }

          if (data) {
            setWebhookEnabled(data.enabled);
            setWebhookUrl(data.url);
            setOriginalValues(current => ({
              ...current,
              webhooks: {
                enabled: data.enabled,
                url: data.url
              }
            }));
          }
        } catch (error) {
          console.error('Error fetching webhook settings:', error);
        }
      };

      fetchWebhookSettings();
    }

    return () => {
      mounted = false;
    };
  }, [open, formId]);

  // Auto-save webhook settings
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    // If the enabled state changed, save immediately
    if (!isInitialMount && webhookEnabled !== originalValues.webhooks.enabled) {
      const saveWebhookSettings = async () => {
        try {
          const { error } = await supabase
            .from('webhook_settings')
            .upsert({
              form_id: formId,
              enabled: webhookEnabled,
              url: webhookUrl || '',
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'form_id'
            });

          if (error) throw error;

          setOriginalValues(current => ({
            ...current,
            webhooks: {
              enabled: webhookEnabled,
              url: webhookUrl
            }
          }));

          toast.success(
            webhookEnabled 
              ? 'Webhook enabled successfully' 
              : 'Webhook disabled successfully'
          );
        } catch (error) {
          console.error('Error updating webhook settings:', error);
          setWebhookEnabled(originalValues.webhooks.enabled);
          toast.error('Failed to update webhook settings');
        }
      };

      saveWebhookSettings();
      return;
    }

    // For URL changes, use debounce
    if (!isInitialMount && webhookUrl !== originalValues.webhooks.url && webhookEnabled) {
      timeoutId = setTimeout(async () => {
        try {
          if (webhookEnabled && (!webhookUrl || !isValidUrl(webhookUrl))) {
            toast.error('Please enter a valid webhook URL');
            return;
          }

          const { error } = await supabase
            .from('webhook_settings')
            .upsert({
              form_id: formId,
              enabled: webhookEnabled,
              url: webhookUrl,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'form_id'
            });

          if (error) throw error;

          setOriginalValues(current => ({
            ...current,
            webhooks: {
              enabled: webhookEnabled,
              url: webhookUrl
            }
          }));

          toast.success(
            webhookEnabled 
              ? 'Webhook enabled successfully' 
              : 'Webhook disabled successfully'
          );
        } catch (error) {
          console.error('Error updating webhook settings:', error);
          setWebhookEnabled(originalValues.webhooks.enabled);
          setWebhookUrl(originalValues.webhooks.url);
          toast.error('Failed to update webhook settings');
        }
      }, 500);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [webhookEnabled, webhookUrl, formId, originalValues.webhooks, isInitialMount]);

  // Auto-save notification enabled state
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (!isInitialMount && 
        notificationsEnabled !== originalValues.notifications.enabled && 
        originalValues.notifications.emails.length > 0) {
      timeoutId = setTimeout(async () => {
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
      timeoutId = setTimeout(async () => {
        try {
          const { error } = await supabase
            .from('notification_settings')
            .update({ notification_attributes: selectedAttributes })
            .eq('form_id', formId);

          if (error) throw error;

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
      const fetchSettings = async () => {
        setIsInitialMount(true);

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
          const isEnabled = data.length > 0 ? data[0].enabled : false;
          
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

          updates();

          requestAnimationFrame(() => {
            if (mounted) {
              setIsInitialMount(false);
            }
          });
        } else {
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

  // Fetch initial settings
  useEffect(() => {
    let mounted = true;
    
    if (open && formId) {
      const fetchSettings = async () => {
        try {
          const { data, error } = await supabase
            .from('forms')
            .select('gif_urls')
            .eq('id', formId)
            .single();
            
          if (!mounted) return;
          
          if (error) {
            console.error('Error fetching GIF URLs:', error);
            return;
          }
          
          if (data && data.gif_urls) {
            setGifUrls(data.gif_urls);
            setGifUrlsText(data.gif_urls.join('\n'));
            setOriginalValues(current => ({
              ...current,
              styling: {
                ...current.styling,
                gifUrls: data.gif_urls
              }
            }));
          }
        } catch (error) {
          console.error('Error fetching GIF URLs:', error);
        }
      };
      
      fetchSettings();
    }
    
    return () => {
      mounted = false;
    };
  }, [open, formId]);

  // Process gifUrlsText changes
  useEffect(() => {
    if (!isInitialMount) {
      // Split by newlines and filter out empty lines
      const urls = gifUrlsText
        .split('\n')
        .map(url => url.trim())
        .filter(url => url && isValidUrl(url));
      
      setGifUrls(urls);
    }
  }, [gifUrlsText, isInitialMount]);

  // Fetch custom email settings
  useEffect(() => {
    let mounted = true;

    if (open && formId) {
      const fetchCustomEmailSettings = async () => {
        try {
          const { data, error } = await supabase
            .from('custom_email_settings')
            .select('id, custom_email, verified, form_id')
            .eq('form_id', formId)
            .single();

          if (!mounted) return;

          if (error && error.code !== 'PGRST116') { // Not found error
            console.error('Error fetching custom email settings:', error);
            return;
          }

          if (data) {
            setCustomEmail(data.custom_email);
            setCustomEmailStatus(data.verified ? 'verified' : 'unverified');
            setCustomEmailId(data.id);
          } else {
            setCustomEmail('');
            setCustomEmailStatus('none');
            setCustomEmailId(null);
          }

          // Get sender name
          const { data: formData, error: formError } = await supabase
            .from('forms')
            .select('default_sender_name')
            .eq('id', formId)
            .single();

          if (!formError && formData) {
            setSenderName(formData.default_sender_name || '');
          }
        } catch (error) {
          console.error('Error in custom email settings fetch:', error);
        }
      };

      fetchCustomEmailSettings();
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
    // Reset all form values to original values
    onOpenChange(false)
    setColor(buttonColor);
    setText(supportText || '');
    setUrl(formUrl);
    setShortcut(keyboardShortcut || '');
    setSoundEnabled(initialSoundEnabled);
    setShowGifOnSuccess(initialShowGifOnSuccess);
    setRemoveBranding(initialRemoveBranding);
    setGifUrls(initialGifUrls);
    setGifUrlsText(initialGifUrls.join('\n'));
    
    // Reset custom email states
    setIsVerificationSent(false);
    setCustomEmailError('');
  }

  useEffect(() => {
    setColor(buttonColor);
    setText(supportText || '');
    setUrl(formUrl);
    setShortcut(keyboardShortcut || '');
    setSoundEnabled(initialSoundEnabled);
    setShowGifOnSuccess(initialShowGifOnSuccess);
    setRemoveBranding(initialRemoveBranding);
  }, [buttonColor, supportText, formUrl, keyboardShortcut, initialSoundEnabled, initialShowGifOnSuccess, initialRemoveBranding]);

  // Auto-save sound enabled state
  /*
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (!isInitialMount && soundEnabled !== originalValues.styling.soundEnabled) {
      timeoutId = setTimeout(async () => {
        try {
          const { error } = await supabase
            .from('forms')
            .update({ sound_enabled: soundEnabled })
            .eq('id', formId);

          if (error) throw error;

          setOriginalValues(current => ({
            ...current,
            styling: {
              ...current.styling,
              soundEnabled
            }
          }));

          onSettingsSaved();

          toast.success(soundEnabled ? 'Sound enabled successfully' : 'Sound disabled successfully');
        } catch (error) {
          console.error('Error updating sound enabled:', error);
          setSoundEnabled(originalValues.styling.soundEnabled);
          toast.error(`Failed to ${soundEnabled ? 'enable' : 'disable'} sound`);
        }
      }, 500);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [soundEnabled, formId, originalValues.styling.soundEnabled, onSettingsSaved, isInitialMount]);
  */

  // Auto-save showGifOnSuccess setting
  /*
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (!isInitialMount && showGifOnSuccess !== originalValues.styling.showGifOnSuccess) {
      timeoutId = setTimeout(async () => {
        try {
          const { error } = await supabase
            .from('forms')
            .update({ show_gif_on_success: showGifOnSuccess })
            .eq('id', formId);

          if (error) throw error;

          setOriginalValues(current => ({
            ...current,
            styling: {
              ...current.styling,
              showGifOnSuccess
            }
          }));

          onSettingsSaved();

          toast.success(
            showGifOnSuccess 
              ? 'Success GIF enabled' 
              : 'Success GIF disabled'
          );
        } catch (error) {
          console.error('Error updating showGifOnSuccess setting:', error);
          setShowGifOnSuccess(originalValues.styling.showGifOnSuccess);
          toast.error(`Failed to ${showGifOnSuccess ? 'enable' : 'disable'} success GIF`);
        }
      }, 500);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [showGifOnSuccess, formId, originalValues.styling.showGifOnSuccess, onSettingsSaved, isInitialMount]);
  */

  // Auto-save gifUrls
  /*
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (!isInitialMount && !areArraysEqual(gifUrls, originalValues.styling.gifUrls) && showGifOnSuccess) {
      timeoutId = setTimeout(async () => {
        try {
          const { error } = await supabase
            .from('forms')
            .update({ gif_urls: gifUrls })
            .eq('id', formId);

          if (error) throw error;

          setOriginalValues(current => ({
            ...current,
            styling: {
              ...current.styling,
              gifUrls
            }
          }));

          onSettingsSaved();

          toast.success('GIF URLs updated successfully');
        } catch (error) {
          console.error('Error updating GIF URLs:', error);
          setGifUrls(originalValues.styling.gifUrls);
          setGifUrlsText(originalValues.styling.gifUrls.join('\n'));
          toast.error('Failed to update GIF URLs');
        }
      }, 500);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [gifUrls, formId, originalValues.styling.gifUrls, onSettingsSaved, isInitialMount, showGifOnSuccess]);
  */

  // Set isInitialMount to false after the first render
  useEffect(() => {
    setIsInitialMount(false);
  }, []);

  // Clean up URL as user types or pastes
  const handleUrlChange = (value: string) => {
    const cleanUrl = value
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '');
    
    setUrl(cleanUrl);
  };

  // Handle URL blur (focus out) to save changes
  const handleUrlBlur = async () => {
    if (url === originalValues.styling.url) {
      return;
    }

    if (!isValidUrl(url)) {
      setUrl(originalValues.styling.url);
      toast.error('Please enter a valid URL');
      return;
    }

    try {
      const { error } = await supabase
        .from('forms')
        .update({ url })
        .eq('id', formId);

      if (error) throw error;

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
  };

  // Handle text blur to save changes
  const handleTextBlur = async () => {
    if (text === originalValues.styling.supportText) {
      return;
    }

    try {
      const { error } = await supabase
        .from('forms')
        .update({ support_text: text || null })
        .eq('id', formId);

      if (error) throw error;

      setOriginalValues(current => ({
        ...current,
        styling: {
          ...current.styling,
          supportText: text
        }
      }));

      onSettingsSaved();

      toast.success('Support text updated successfully');
    } catch (error) {
      console.error('Error updating support text:', error);
      setText(originalValues.styling.supportText);
      toast.error('Failed to update support text');
    }
  };

  // Handle color blur to save changes
  const handleColorBlur = async () => {
    if (color === originalValues.styling.buttonColor) {
      return;
    }

    if (!isValidHexColor(color)) {
      setColor(originalValues.styling.buttonColor);
      toast.error('Please enter a valid hex color');
      return;
    }

    try {
      const { error } = await supabase
        .from('forms')
        .update({ button_color: color })
        .eq('id', formId);

      if (error) throw error;

      setOriginalValues(current => ({
        ...current,
        styling: {
          ...current.styling,
          buttonColor: color
        }
      }));

      onSettingsSaved();

      toast.success('Button color updated successfully');
    } catch (error) {
      console.error('Error updating button color:', error);
      setColor(originalValues.styling.buttonColor);
      toast.error('Failed to update button color');
    }
  };

  // Handle shortcut blur to save changes
  const handleShortcutBlur = async () => {
    if (shortcut === originalValues.styling.keyboardShortcut) {
      return;
    }

    try {
      const { error } = await supabase
        .from('forms')
        .update({ keyboard_shortcut: shortcut || null })
        .eq('id', formId);

      if (error) throw error;

      setOriginalValues(current => ({
        ...current,
        styling: {
          ...current.styling,
          keyboardShortcut: shortcut
        }
      }));

      onSettingsSaved();

      toast.success('Keyboard shortcut updated successfully');
    } catch (error) {
      console.error('Error updating keyboard shortcut:', error);
      setShortcut(originalValues.styling.keyboardShortcut);
      toast.error('Failed to update keyboard shortcut');
    }
  };

  // Handle GIF URLs text blur to save changes
  const handleGifUrlsBlur = async () => {
    // Split by newlines and filter out empty lines
    const urls = gifUrlsText
      .split('\n')
      .map(url => url.trim())
      .filter(url => url && isValidUrl(url));
    
    if (areArraysEqual(urls, originalValues.styling.gifUrls)) {
      return;
    }
    
    try {
      const { error } = await supabase
        .from('forms')
        .update({ gif_urls: urls })
        .eq('id', formId);

      if (error) throw error;

      setGifUrls(urls);
      setOriginalValues(current => ({
        ...current,
        styling: {
          ...current.styling,
          gifUrls: urls
        }
      }));

      onSettingsSaved();

      toast.success('GIF URLs updated successfully');
    } catch (error) {
      console.error('Error updating GIF URLs:', error);
      setGifUrlsText(originalValues.styling.gifUrls.join('\n'));
      toast.error('Failed to update GIF URLs');
    }
  };

  // Handle switch toggle to save changes
  const handleSoundEnabledChange = async (checked: boolean) => {
    if (checked === originalValues.styling.soundEnabled) {
      return;
    }

    setSoundEnabled(checked);
    
    try {
      const { error } = await supabase
        .from('forms')
        .update({ sound_enabled: checked })
        .eq('id', formId);

      if (error) throw error;

      setOriginalValues(current => ({
        ...current,
        styling: {
          ...current.styling,
          soundEnabled: checked
        }
      }));

      onSettingsSaved();

      toast.success(`Sound ${checked ? 'enabled' : 'disabled'} successfully`);
    } catch (error) {
      console.error('Error updating sound enabled:', error);
      setSoundEnabled(originalValues.styling.soundEnabled);
      toast.error(`Failed to ${checked ? 'enable' : 'disable'} sound`);
    }
  };

  // Handle GIF on success toggle to save changes
  const handleShowGifOnSuccessChange = async (checked: boolean) => {
    if (checked === originalValues.styling.showGifOnSuccess) {
      return;
    }

    setShowGifOnSuccess(checked);
    
    try {
      // Log current GIF URLs when toggling for clarity (makes TypeScript aware gifUrls is used)
      if (checked && gifUrls.length > 0) {
        console.log(`Enabling GIF on success with ${gifUrls.length} custom GIFs available`);
      }
      
      const { error } = await supabase
        .from('forms')
        .update({ show_gif_on_success: checked })
        .eq('id', formId);

      if (error) throw error;

      setOriginalValues(current => ({
        ...current,
        styling: {
          ...current.styling,
          showGifOnSuccess: checked
        }
      }));

      onSettingsSaved();

      toast.success(`Success GIF ${checked ? 'enabled' : 'disabled'} successfully`);
    } catch (error) {
      console.error('Error updating show GIF on success:', error);
      setShowGifOnSuccess(originalValues.styling.showGifOnSuccess);
      toast.error(`Failed to ${checked ? 'enable' : 'disable'} success GIF`);
    }
  };

  // Handle remove branding toggle to save changes
  const handleRemoveBrandingChange = async (checked: boolean) => {
    if (checked === originalValues.styling.removeBranding) {
      return;
    }

    setRemoveBranding(checked);
    
    try {
      const { error } = await supabase
        .from('forms')
        .update({ remove_branding: checked })
        .eq('id', formId);

      if (error) throw error;

      setOriginalValues(current => ({
        ...current,
        styling: {
          ...current.styling,
          removeBranding: checked
        }
      }));

      onSettingsSaved();

      toast.success(`Branding ${checked ? 'removed' : 'enabled'} successfully`);
    } catch (error) {
      console.error('Error updating remove branding:', error);
      setRemoveBranding(originalValues.styling.removeBranding);
      toast.error(`Failed to ${checked ? 'remove' : 'enable'} branding`);
    }
  };

  const handleVerifyCustomEmail = async () => {
    if (!customEmail.trim()) {
      setCustomEmailError('Email is required');
      return;
    }
    
    if (!isValidEmail(customEmail)) {
      setCustomEmailError('Invalid email address');
      return;
    }

    setIsUpdatingEmail(true);
    setCustomEmailError('');

    try {
      const supabaseToken = await getSupabaseToken();
      
      const response = await fetch('/.netlify/functions/verify-custom-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseToken}`
        },
        body: JSON.stringify({
          formId,
          customEmail,
          senderName
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to send verification email');
      }

      setIsVerificationSent(true);
      setCustomEmailStatus('unverified');
      toast.success('Verification email sent successfully');
    } catch (error) {
      console.error('Error verifying custom email:', error);
      setCustomEmailError('Failed to send verification email');
      toast.error('Failed to send verification email');
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-[56rem] p-0 flex flex-col !gap-0 h-[90vh]">
          <DialogHeader className="px-4 py-3 border-b border-border flex-row flex items-center justify-between">
            <DialogTitle className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Settings</DialogTitle>
            <DialogClose className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </DialogHeader>
          <div className="flex flex-1 overflow-hidden">
            <div className="w-48 border-r border-border">
              <div className="px-4 py-4 space-y-1">
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
                  onClick={() => handleTabSwitch('email')}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                    activeTab === 'email' ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                  </svg>
                  Custom Email
                </button>
                <button
                  onClick={() => handleTabSwitch('webhooks')}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                    activeTab === 'webhooks' ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Webhook className="w-4 h-4" />
                  Webhooks
                </button>
                <button
                  onClick={() => handleTabSwitch('tags')}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                    activeTab === 'tags' ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Tag className="w-4 h-4" />
                  Tags
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
            <div className="flex-1 overflow-auto">
              <div className="p-6 h-full">
                {activeTab === 'styling' && (
                  <div className="space-y-8">
                    <div className="space-y-3">
                      <Label htmlFor="url">Website URL</Label>
                      <div className="flex gap-2">
                        <span className="flex items-center text-sm text-muted-foreground">https://</span>
                        <Input
                          id="url"
                          value={url}
                          onChange={(e) => handleUrlChange(e.target.value)}
                          onBlur={handleUrlBlur}
                          placeholder="app.userbird.co"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        The domain where your widget is installed
                      </p>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="buttonColor">Button Color</Label>
                      <div className="flex gap-2">
                        <Input
                          id="buttonColor"
                          type="color"
                          value={color}
                          onChange={(e) => setColor(e.target.value)}
                          onBlur={handleColorBlur}
                          className="w-20"
                        />
                        <Input
                          value={color}
                          onChange={(e) => setColor(e.target.value)}
                          onBlur={handleColorBlur}
                          placeholder="#1f2937"
                          pattern="^#[0-9a-fA-F]{6}$"
                          className="font-mono"
                        />
                      </div>
                    </div>

                    <div className="border-t pt-6">
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Label>Remove branding</Label>
                          <Switch
                            checked={removeBranding}
                            onCheckedChange={handleRemoveBrandingChange}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Remove "We run on Userbird" branding from the widget
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="supportText">Support Text (optional)</Label>
                      <Input
                        id="supportText"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onBlur={handleTextBlur}
                        placeholder="Have a specific issue? [Contact support](https://example.com) or [read our docs](https://docs.example.com)"
                        className="font-mono"
                      />
                      <p className="text-xs text-muted-foreground">
                        Add optional support text with markdown links. Example: [Link text](https://example.com)
                      </p>
                    </div>

                    <div className="border-t pt-6">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="shortcut">Keyboard Shortcut</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="text"
                              className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 font-mono w-32"
                              id="shortcut"
                              placeholder="Press keys..."
                              value={shortcut}
                              onBlur={handleShortcutBlur}
                              onKeyDown={(e) => {
                                e.preventDefault();
                                // Ignore Backspace key
                                if (e.key === 'Backspace') return;
                                
                                const keys = [];
                                if (e.metaKey) keys.push('Meta');
                                if (e.ctrlKey) keys.push('Control');
                                if (e.shiftKey) keys.push('Shift');
                                if (e.altKey) keys.push('Alt');
                                // Only add regular keys that aren't modifiers or Backspace
                                if (!['Control', 'Shift', 'Alt', 'Meta', 'Backspace'].includes(e.key)) {
                                  keys.push(e.key.toUpperCase());
                                }
                                if (keys.length > 0) {
                                  setShortcut(keys.join('+'));
                                }
                              }}
                              onKeyUp={(e) => {
                                e.preventDefault();
                              }}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="hover:bg-accent h-8 rounded-md px-3 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setShortcut('');
                              handleShortcutBlur();
                            }}
                          >
                            Clear
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-6">
                      <div className="space-y-3 mb-6">
                        <div className="flex items-center space-x-2">
                          <Label>Play sound on success</Label>
                          <Switch
                            checked={soundEnabled}
                            onCheckedChange={handleSoundEnabledChange}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Play a notification sound when feedback is submitted
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Label>Show GIF on success</Label>
                          <Switch
                            checked={showGifOnSuccess}
                            onCheckedChange={handleShowGifOnSuccessChange}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Display a GIF when feedback is successfully submitted
                        </p>
                        
                        {showGifOnSuccess && (
                          <div className="mt-5 space-y-3">
                            <Label htmlFor="gifUrls">Custom GIF URLs</Label>
                            <Textarea
                              id="gifUrls"
                              value={gifUrlsText}
                              onChange={(e) => setGifUrlsText(e.target.value)}
                              onBlur={handleGifUrlsBlur}
                              placeholder="https://example.com/gif1.gif&#10;https://example.com/gif2.gif&#10;https://example.com/gif3.gif"
                              className="min-h-[100px]"
                            />
                            <p className="text-xs text-muted-foreground">
                              Enter one GIF URL per line. The platform will randomly display one of these GIFs when feedback is submitted. If no URLs are provided, the default GIF will be used.
                            </p>
                          </div>
                        )}
                      </div>
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
                                id={`${attr.id}-notification`}
                                checked={selectedAttributes.includes(attr.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedAttributes([...selectedAttributes, attr.id]);
                                  } else {
                                    setSelectedAttributes(selectedAttributes.filter(a => a !== attr.id));
                                  }
                                }}
                              />
                              <Label>{attr.label}</Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'email' && (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Label>Custom Sender Email</Label>
                          <p className="text-sm text-muted-foreground">
                            Set a custom email address to use as the sender when users reply to feedback.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <Label className="text-sm mb-1">Sender Name (Optional)</Label>
                          <Input
                            value={senderName}
                            onChange={(e) => setSenderName(e.target.value)}
                            placeholder="Your Company Name"
                            className="mb-3"
                          />
                          
                          <Label className="text-sm mb-1">Email Address</Label>
                          <div className="flex gap-2">
                            <Input
                              value={customEmail}
                              onChange={(e) => {
                                setCustomEmail(e.target.value);
                                setCustomEmailError('');
                                setIsVerificationSent(false);
                              }}
                              placeholder="support@yourcompany.com"
                              className={customEmailError ? 'border-destructive' : ''}
                            />
                            <Button 
                              onClick={handleVerifyCustomEmail}
                              disabled={isUpdatingEmail}
                            >
                              {customEmailStatus === 'verified' ? 'Update Email' : 'Verify Email'}
                            </Button>
                          </div>
                          {customEmailError && (
                            <p className="text-sm text-destructive mt-1">{customEmailError}</p>
                          )}
                        </div>

                        {customEmailStatus !== 'none' && (
                          <div className={cn(
                            "p-3 rounded-md text-sm",
                            customEmailStatus === 'verified' 
                              ? "bg-green-50 text-green-800 border border-green-200" 
                              : "bg-yellow-50 text-yellow-800 border border-yellow-200"
                          )}>
                            {customEmailStatus === 'verified' ? (
                              <p className="flex items-center">
                                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M5 13L9 17L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <span>
                                  <strong>{customEmail}</strong> is verified and will be used as the sender email address.
                                </span>
                              </p>
                            ) : isVerificationSent ? (
                              <p>
                                Verification email sent to <strong>{customEmail}</strong>. Please check your inbox and click the verification link.
                              </p>
                            ) : (
                              <p>
                                <strong>{customEmail}</strong> needs verification. Click "Verify Email" to send a verification link.
                              </p>
                            )}
                          </div>
                        )}

                        {customEmailStatus === 'none' && (
                          <p className="text-sm text-muted-foreground">
                            By default, all emails are sent from notifications@userbird.co. Verify a custom email address to send from your own domain.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4 mt-6">
                      <div className="border-t pt-6">
                        <h3 className="text-sm font-medium">What happens when you set a custom email?</h3>
                        <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                          <p>
                            When you verify a custom email address:
                          </p>
                          <ul className="list-disc pl-5 space-y-2">
                            <li>Your verified email becomes the "From" address for all outgoing notifications and replies.</li>
                            <li>When users reply to feedback emails, replies will go directly to your custom email address.</li>
                            <li>This creates a seamless experience where users see your brand's email address rather than Userbird's.</li>
                          </ul>
                          <p className="mt-4">
                            <strong>Note:</strong> You may need to set up SPF and DKIM records for your domain to ensure deliverability. 
                            Contact your email provider or domain registrar for specific instructions.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'webhooks' && (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Label>Webhook</Label>
                          <p className="text-sm text-muted-foreground">
                            Add a webhook to receive notifications when new feedback is submitted.
                          </p>
                          <div className="flex items-center space-x-2 pt-2">
                            <Switch
                              checked={webhookEnabled}
                              onCheckedChange={(checked) => setWebhookEnabled(checked)}
                            />
                            <Label className="text-sm font-normal">
                              {webhookEnabled ? 'Webhook enabled' : 'Webhook disabled'}
                            </Label>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex gap-2">
                          <Input
                            value={webhookUrl}
                            onChange={(e) => setWebhookUrl(e.target.value)}
                            placeholder="https://example.com/webhook"
                            className={webhookEnabled ? '' : 'border-destructive'}
                          />
                          <Button onClick={() => {
                            setWebhookUrl('');
                            setWebhookEnabled(false);
                          }}>
                            Remove Webhook
                          </Button>
                        </div>
                        {webhookEnabled && !isValidUrl(webhookUrl) && (
                          <p className="text-sm text-destructive">Please enter a valid webhook URL</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'tags' && (
                  <div className="space-y-6">
                    {children}
                  </div>
                )}

                {activeTab === 'delete' && (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Label>Delete Form</Label>
                          <p className="text-sm text-muted-foreground">
                            Are you sure you want to delete this form?
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setShowDeleteDialog(true);
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
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
  )
}