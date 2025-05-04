import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface SlackIntegrationTabProps {
  formId: string;
  enabled?: boolean;
  workspaceName?: string;
  channelName?: string;
  onEnabledChange?: (enabled: boolean) => void;
  onEnabledBlur?: () => void;
}

export function SlackIntegrationTab({
  formId,
  enabled = false,
  workspaceName,
  channelName,
  onEnabledChange,
  onEnabledBlur
}: SlackIntegrationTabProps) {
  // Local state fallback if parent doesn't control
  const [localEnabled, setLocalEnabled] = useState(enabled);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Update local state when props change
  useEffect(() => {
    setLocalEnabled(enabled);
  }, [enabled]);

  // Check URL for success or error params (after OAuth redirect)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    const successParam = params.get('success');
    const errorParam = params.get('error');

    // Only process if we're on the integrations tab
    if (tabParam === 'integrations') {
      if (successParam === 'true') {
        setSuccessMessage('Slack connected successfully!');
        // Clear the success parameter from URL
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('success');
        window.history.replaceState({}, '', newUrl);

        // Auto-dismiss success message after 5 seconds
        setTimeout(() => {
          setSuccessMessage(null);
        }, 5000);
      } else if (errorParam) {
        setError(`Failed to connect to Slack: ${decodeURIComponent(errorParam)}`);
        // Clear the error parameter from URL
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('error');
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, []);

  // Handle toggle change
  const handleToggleChange = (checked: boolean) => {
    if (onEnabledChange) {
      // Parent controls state
      onEnabledChange(checked);
    } else {
      // Local state
      setLocalEnabled(checked);
    }

    // If turning off, update immediately
    if (!checked) {
      handleToggleBlur();
    }
  };

  // Handle toggle blur (save)
  const handleToggleBlur = () => {
    if (onEnabledBlur) {
      // Parent handles saving
      onEnabledBlur();
    } else {
      // Local saving logic
      saveSlackSettings();
    }
  };

  // Local save function (only used if parent doesn't control)
  const saveSlackSettings = async () => {
    try {
      const { error } = await supabase
        .from('slack_integrations')
        .upsert({
          form_id: formId,
          enabled: localEnabled,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'form_id'
        });

      if (error) throw error;
      toast.success(localEnabled ? 'Slack integration enabled' : 'Slack integration disabled');
    } catch (error) {
      console.error('Error saving Slack settings:', error);
      setLocalEnabled(!localEnabled); // Revert on error
      toast.error('Failed to update Slack integration settings');
    }
  };

  // Connect to Slack
  const connectToSlack = () => {
    setIsConnecting(true);
    setError(null);

    try {
      // Create the Slack authorization URL
      const slackClientId = import.meta.env.VITE_SLACK_CLIENT_ID;
      if (!slackClientId) {
        throw new Error('Slack client ID not configured');
      }

      // Use the current hostname for the redirect URI
      const redirectUri = `${window.location.origin}/.netlify/functions/slack-oauth-callback`;
      
      // Use the form ID as the state parameter for tracking
      const state = formId;

      // Scopes needed for the integration
      const scopes = ['chat:write', 'channels:read'];

      // Build the authorization URL
      const authUrl = new URL('https://slack.com/oauth/v2/authorize');
      authUrl.searchParams.append('client_id', slackClientId);
      authUrl.searchParams.append('scope', scopes.join(' '));
      authUrl.searchParams.append('redirect_uri', redirectUri);
      authUrl.searchParams.append('state', state);

      // Redirect to Slack authorization page
      window.location.href = authUrl.toString();
    } catch (error) {
      console.error('Error connecting to Slack:', error);
      setError(error instanceof Error ? error.message : 'Failed to connect to Slack');
      setIsConnecting(false);
    }
  };

  // Disconnect from Slack
  const disconnectFromSlack = async () => {
    try {
      const { error } = await supabase
        .from('slack_integrations')
        .update({ 
          enabled: false,
          channel_id: null,
          channel_name: null,
          bot_token: null,
          updated_at: new Date().toISOString()
        })
        .eq('form_id', formId);

      if (error) throw error;

      // Update local state
      if (onEnabledChange) {
        onEnabledChange(false);
      } else {
        setLocalEnabled(false);
      }

      toast.success('Slack integration disconnected');
    } catch (error) {
      console.error('Error disconnecting from Slack:', error);
      toast.error('Failed to disconnect Slack integration');
    }
  };

  // Determine connection status and button text
  const isConnected = !!workspaceName;
  const buttonText = isConnected 
    ? `Connected to ${workspaceName}${channelName ? ` (#${channelName})` : ''}`
    : 'Connect to Slack';

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Slack Integration</h3>
        <p className="text-sm text-muted-foreground">
          Send new feedback to Slack and reply directly from your Slack channels.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert className="bg-green-50 text-green-800 border-green-200">
          <Check className="h-4 w-4 text-green-600" />
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="slack-integration">Enable Slack integration</Label>
          <p className="text-xs text-muted-foreground">
            {isConnected 
              ? 'Receive feedback notifications in your Slack channel'
              : 'Connect your Slack workspace to receive feedback notifications'}
          </p>
        </div>
        <Switch
          id="slack-integration"
          checked={onEnabledChange ? enabled : localEnabled}
          onCheckedChange={handleToggleChange}
          onBlur={handleToggleBlur}
          disabled={!isConnected}
        />
      </div>

      <div>
        <Button
          onClick={isConnected ? disconnectFromSlack : connectToSlack}
          variant={isConnected ? "outline" : "default"}
          disabled={isConnecting}
          className={isConnected ? "bg-slate-100" : ""}
        >
          {isConnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isConnected ? "Disconnect from Slack" : "Connect to Slack"}
        </Button>

        {isConnected && (
          <p className="mt-2 text-sm text-muted-foreground">
            {buttonText}
          </p>
        )}
      </div>

      {isConnected && !channelName && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please configure a channel to receive feedback notifications.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
} 