import { useState, useEffect } from 'react'
import { Palette, Trash2, Bell, X, Webhook, Tag, Mail, Users, Sparkles } from 'lucide-react'
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
import { CustomEmailTab } from './custom-email-tab'
import { CollaboratorsTab } from './collaborators-tab'
import { AIAutomationTab } from './ai-automation-tab'
import type { ScrapingProcess } from './ai-automation-tab'

// Interfaces for form settings
interface FormSettingsDialogProps {
  formId: string
  formUrl: string
  productName: string | null
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

type SettingsTab = 'styling' | 'notifications' | 'webhooks' | 'tags' | 'delete' | 'emails' | 'collaborators' | 'ai-automation'

export function FormSettingsDialog({ 
  formId, 
  formUrl,
  productName,
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
      productName: '',
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
  const [product, setProduct] = useState(productName || '')
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
  const [latestScrapingProcess, setLatestScrapingProcess] = useState<ScrapingProcess | null>(null)
  const [formRules, setFormRules] = useState<string | null>(null)
  const [originalRules, setOriginalRules] = useState<string | null>(null)

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

  // Set initial values when component mounts
  useEffect(() => {
    if (isInitialMount) {
      setOriginalValues((prev) => ({
        ...prev,
        styling: {
          ...prev.styling,
          buttonColor,
          supportText: supportText || '',
          url: formUrl,
          productName: productName || '',
          keyboardShortcut: keyboardShortcut || '',
          soundEnabled: initialSoundEnabled,
          showGifOnSuccess: initialShowGifOnSuccess,
          removeBranding: initialRemoveBranding,
          gifUrls: initialGifUrls || []
        }
      }));
      setIsInitialMount(false);
    }
  }, [
    isInitialMount, 
    buttonColor, 
    supportText, 
    formUrl,
    productName,
    keyboardShortcut,
    initialSoundEnabled,
    initialShowGifOnSuccess,
    initialRemoveBranding,
    initialGifUrls
  ]);

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

  // Fetch the latest scraping process and rules when the dialog opens
  useEffect(() => {
    if (open && formId) {
      fetchLatestScrapingProcess();
      fetchFormRules();
    }
  }, [open, formId]);

  // Function to fetch the latest scraping process
  const fetchLatestScrapingProcess = async () => {
    if (!formId) return;
    
    try {
      console.log('[FormSettingsDialog] Fetching latest scraping process for form ID:', formId);
      const { data, error } = await supabase
        .from('docs_scraping_processes')
        .select('*')
        .eq('form_id', formId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
      if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        console.error('[FormSettingsDialog] Error fetching scraping process:', error);
      } else if (data) {
        console.log('[FormSettingsDialog] Successfully fetched scraping process:', data.id);
        
        // Ensure metadata is not null
        data.metadata = data.metadata || {};
        
        setLatestScrapingProcess(data);
      } else {
        console.log('[FormSettingsDialog] No previous scraping processes found for this form');
      }
    } catch (error) {
      console.error('[FormSettingsDialog] Exception when fetching scraping process:', error);
    }
  };

  // Function to fetch form rules
  const fetchFormRules = async () => {
    if (!formId) return;
    
    try {
      console.log('[FormSettingsDialog] Fetching form rules...');
      const { data, error } = await supabase
        .from('forms')
        .select('rules')
        .eq('id', formId)
        .single();
      
      if (error) {
        console.error('[FormSettingsDialog] Error fetching form rules:', error);
        return;
      }
      
      console.log('[FormSettingsDialog] Successfully fetched form rules:', data.rules);
      setFormRules(data.rules);
      setOriginalRules(data.rules);
    } catch (error) {
      console.error('[FormSettingsDialog] Exception when fetching form rules:', error);
    }
  };

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
    
    // If switching to AI tab, refresh the data
    if (newTab === 'ai-automation' && formId) {
      console.log('[FormSettingsDialog] Switching to AI tab, refreshing data');
      fetchLatestScrapingProcess();
      fetchFormRules();
    }
  };

  const handleDialogClose = () => {
    // Prevent focus issues when dialog closes
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    
    // Reset relevant form values to original values - but don't reset AI rules
    // since they are handled by the AIAutomationTab component
    onOpenChange(false);
    setColor(buttonColor);
    setText(supportText || '');
    setUrl(formUrl);
    setShortcut(keyboardShortcut || '');
    setSoundEnabled(initialSoundEnabled);
    setShowGifOnSuccess(initialShowGifOnSuccess);
    setRemoveBranding(initialRemoveBranding);
    setGifUrls(initialGifUrls);
    setGifUrlsText(initialGifUrls.join('\n'));
  };

  // Set form values when props change
  useEffect(() => {
    setColor(buttonColor);
    setText(supportText || '');
    setUrl(formUrl);
    setProduct(productName || '');
    setShortcut(keyboardShortcut || '');
    setSoundEnabled(initialSoundEnabled);
    setShowGifOnSuccess(initialShowGifOnSuccess);
    setRemoveBranding(initialRemoveBranding);
    
    // Debug log to verify productName is being received correctly
    console.log('[FormSettingsDialog] Updated product name from props:', {
      receivedProductName: productName,
      setProductValue: productName || ''
    });
  }, [buttonColor, supportText, formUrl, productName, keyboardShortcut, initialSoundEnabled, initialShowGifOnSuccess, initialRemoveBranding]);

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

  // Handle product name blur to save changes
  const handleProductNameBlur = async () => {
    if (product === originalValues.styling.productName) {
      return;
    }

    try {
      const { error } = await supabase
        .from('forms')
        .update({ product_name: product || null })
        .eq('id', formId);

      if (error) throw error;

      setOriginalValues(current => ({
        ...current,
        styling: {
          ...current.styling,
          productName: product
        }
      }));

      onSettingsSaved();

      toast.success('Product name updated successfully');
    } catch (error) {
      console.error('Error updating product name:', error);
      setProduct(originalValues.styling.productName);
      toast.error('Failed to update product name');
    }
  };

  // Handle rules change
  const handleRulesChange = (value: string) => {
    setFormRules(value);
  };

  // Handle rules blur to save changes
  const handleRulesBlur = async () => {
    if (formRules === originalRules) {
      return;
    }

    try {
      const { error } = await supabase
        .from('forms')
        .update({ rules: formRules })
        .eq('id', formId);

      if (error) throw error;

      setOriginalRules(formRules);
      toast.success('AI rules saved successfully');
    } catch (error) {
      console.error('Error updating AI rules:', error);
      setFormRules(originalRules);
      toast.error('Failed to update AI rules');
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
                  onClick={() => handleTabSwitch('emails')}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                    activeTab === 'emails' ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Mail className="w-4 h-4" />
                  Custom Email
                </button>
                <button
                  onClick={() => handleTabSwitch('collaborators')}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                    activeTab === 'collaborators' ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Users className="w-4 h-4" />
                  Collaborators
                </button>
                <button
                  onClick={() => handleTabSwitch('ai-automation')}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                    activeTab === 'ai-automation' ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Sparkles className="w-4 h-4" />
                  AI Automation
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
                      <Label htmlFor="productName">Product Name</Label>
                      <Input
                        id="productName"
                        value={product}
                        onChange={(e) => setProduct(e.target.value)}
                        onBlur={handleProductNameBlur}
                        placeholder="My Product"
                      />
                      <p className="text-xs text-muted-foreground">
                        A friendly name for your product shown in the forms dropdown
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
                          Remove "We run on Userbird" branding from the widget and outbound emails
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

                {activeTab === 'emails' && (
                  <CustomEmailTab formId={formId} />
                )}

                {activeTab === 'collaborators' && (
                  <CollaboratorsTab formId={formId} />
                )}

                {activeTab === 'ai-automation' && (
                  <div className="space-y-6">
                    <AIAutomationTab 
                      formId={formId} 
                      initialProcess={latestScrapingProcess}
                      formRules={formRules}
                      onRulesChange={handleRulesChange}
                      onRulesBlur={handleRulesBlur}
                    />
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