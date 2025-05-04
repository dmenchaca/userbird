import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SlackChannel {
  id: string;
  name: string;
}

interface SlackIntegrationTabProps {
  formId: string;
  enabled: boolean;
  workspaceName?: string;
  channelName?: string;
  onEnabledChange: (enabled: boolean) => void;
  onEnabledBlur: () => void;
  channels: SlackChannel[];
  selectedChannelId?: string;
  isLoadingChannels: boolean;
  onChannelSelect?: (channelId: string) => void;
  onRefreshChannels?: () => void;
  onDisconnect?: () => void;
}

export function SlackIntegrationTab({
  formId,
  enabled,
  workspaceName,
  channelName,
  onEnabledChange,
  onEnabledBlur,
  channels,
  selectedChannelId,
  isLoadingChannels,
  onChannelSelect,
  onRefreshChannels,
  onDisconnect
}: SlackIntegrationTabProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    const successParam = params.get('success');
    const errorParam = params.get('error');

    if (tabParam === 'integrations') {
      if (successParam === 'true') {
        setSuccessMessage('Slack connected successfully!');
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('success');
        window.history.replaceState({}, '', newUrl);

        setTimeout(() => {
          setSuccessMessage(null);
        }, 5000);
        
        if (onRefreshChannels) {
          onRefreshChannels();
        }
      } else if (errorParam) {
        setError(`Failed to connect to Slack: ${decodeURIComponent(errorParam)}`);
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('error');
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [onRefreshChannels]);

  const handleToggleChange = (checked: boolean) => {
    onEnabledChange(checked);
    
    if (!checked) {
      onEnabledBlur();
    }
  };

  const isConnected = !!workspaceName;
  const buttonText = isConnected 
    ? `Connected to ${workspaceName}${channelName ? ` (#${channelName})` : ''}`
    : 'Connect to Slack';

  const connectToSlack = () => {
    setIsConnecting(true);
    setError(null);

    try {
      const slackClientId = import.meta.env.VITE_SLACK_CLIENT_ID;
      if (!slackClientId) {
        throw new Error('Slack client ID not configured');
      }

      const redirectUri = `${window.location.origin}/.netlify/functions/slack-oauth-callback`;
      
      const state = formId;

      const scopes = ['chat:write', 'channels:read'];

      const authUrl = new URL('https://slack.com/oauth/v2/authorize');
      authUrl.searchParams.append('client_id', slackClientId);
      authUrl.searchParams.append('scope', scopes.join(' '));
      authUrl.searchParams.append('redirect_uri', redirectUri);
      authUrl.searchParams.append('state', state);

      window.location.href = authUrl.toString();
    } catch (error) {
      console.error('Error connecting to Slack:', error);
      setError(error instanceof Error ? error.message : 'Failed to connect to Slack');
      setIsConnecting(false);
    }
  };

  const disconnectFromSlack = () => {
    if (onDisconnect) {
      onDisconnect();
    }
  };

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
          checked={enabled}
          onCheckedChange={handleToggleChange}
          onBlur={onEnabledBlur}
          disabled={!isConnected || !channelName}
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

      {isConnected && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="slack-channel">Select a channel for notifications</Label>
            <div className="flex gap-2">
              <Select
                value={selectedChannelId}
                onValueChange={onChannelSelect}
                disabled={isLoadingChannels || channels.length === 0}
              >
                <SelectTrigger 
                  id="slack-channel" 
                  className={`w-[180px] border-slate-200 border-opacity-50 shadow-sm ${
                    selectedChannelId ? 'border border-slate-300' : 'border-slate-100'
                  } focus:border-slate-300 data-[state=open]:border-0 hover:border-slate-200`}
                >
                  <SelectValue placeholder="Select a channel" />
                </SelectTrigger>
                <SelectContent>
                  {channels.map((channel) => (
                    <SelectItem 
                      key={channel.id} 
                      value={channel.id}
                      className="cursor-pointer hover:bg-accent hover:text-accent-foreground"
                    >
                      #{channel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                size="icon"
                onClick={onRefreshChannels}
                disabled={isLoadingChannels}
              >
                {isLoadingChannels ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-refresh-cw">
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                    <path d="M21 3v5h-5" />
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                    <path d="M3 21v-5h5" />
                  </svg>
                )}
              </Button>
            </div>
            {isLoadingChannels && (
              <p className="text-xs text-muted-foreground">Loading channels...</p>
            )}
            {!channelName && !isLoadingChannels && (
              <p className="text-xs text-orange-500">
                Please select a channel to receive feedback notifications
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 