import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AlertCircle, Check, Loader2, ChevronDown } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SlackChannel {
  id: string;
  name: string;
}

interface SlackIntegrationTabProps {
  formId: string;
  workspaceName?: string;
  channelName?: string;
  channels: SlackChannel[];
  selectedChannelId?: string;
  isLoadingChannels: boolean;
  onChannelSelect?: (channelId: string) => void;
  onRefreshChannels?: () => void;
  onDisconnect?: () => void;
}

export function SlackIntegrationTab({
  formId,
  workspaceName,
  channelName,
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

  const isConnected = !!workspaceName;

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

      const scopes = [
        'chat:write', 
        'channels:read',
        'channels:history',
        'channels:join',
        'groups:read',
        'groups:write',
        'groups:history',
        'team:read',
        'reactions:read',
        'reactions:write',
        'chat:write.customize',
        'usergroups:read',
        'app_mentions:read',
        'users:read',
        'users:read.email'
      ];

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
        <div className="flex items-center gap-4">
          <div className="p-3 w-[50px] h-[50px] flex items-center justify-center bg-slate-50 border border-slate-200 rounded-md">
            <svg width="100%" height="100%" viewBox="0 0 127 127" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g clipPath="url(#clip0_15950_529)">
                <path d="M27.2 80C27.2 87.3 21.3 93.2 14 93.2C6.69999 93.2 0.799988 87.3 0.799988 80C0.799988 72.7 6.69999 66.8 14 66.8H27.2V80ZM33.8 80C33.8 72.7 39.7 66.8 47 66.8C54.3 66.8 60.2 72.7 60.2 80V113C60.2 120.3 54.3 126.2 47 126.2C39.7 126.2 33.8 120.3 33.8 113V80Z" fill="#E01E5A"/>
                <path d="M47 27.0001C39.7 27.0001 33.8 21.1001 33.8 13.8001C33.8 6.5001 39.7 0.600098 47 0.600098C54.3 0.600098 60.2 6.5001 60.2 13.8001V27.0001H47ZM47 33.7001C54.3 33.7001 60.2 39.6001 60.2 46.9001C60.2 54.2001 54.3 60.1001 47 60.1001H13.9C6.60001 60.1001 0.700012 54.2001 0.700012 46.9001C0.700012 39.6001 6.60001 33.7001 13.9 33.7001H47Z" fill="#36C5F0"/>
                <path d="M99.9 46.9001C99.9 39.6001 105.8 33.7001 113.1 33.7001C120.4 33.7001 126.3 39.6001 126.3 46.9001C126.3 54.2001 120.4 60.1001 113.1 60.1001H99.9V46.9001ZM93.3 46.9001C93.3 54.2001 87.4 60.1001 80.1 60.1001C72.8 60.1001 66.9 54.2001 66.9 46.9001V13.8001C66.9 6.5001 72.8 0.600098 80.1 0.600098C87.4 0.600098 93.3 6.5001 93.3 13.8001V46.9001Z" fill="#2EB67D"/>
                <path d="M80.1 99.8C87.4 99.8 93.3 105.7 93.3 113C93.3 120.3 87.4 126.2 80.1 126.2C72.8 126.2 66.9 120.3 66.9 113V99.8H80.1ZM80.1 93.2C72.8 93.2 66.9 87.3 66.9 80C66.9 72.7 72.8 66.8 80.1 66.8H113.2C120.5 66.8 126.4 72.7 126.4 80C126.4 87.3 120.5 93.2 113.2 93.2H80.1Z" fill="#ECB22E"/>
              </g>
              <defs>
                <clipPath id="clip0_15950_529">
                  <rect width="127" height="127" fill="white"/>
                </clipPath>
              </defs>
            </svg>
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Label htmlFor="slack-integration" className="text-base font-medium leading-6">Slack integration</Label>
              {isConnected && (
                <span className="inline-flex h-6 items-center rounded-full border border-transparent bg-green-50 px-3 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                  Connected
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Manage support tickets and user feedback directly in Slack.
            </p>
          </div>
        </div>
        {isConnected ? (
          <Button
            variant="outline"
            size="sm"
            onClick={disconnectFromSlack}
            className="h-8 text-xs bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-800"
          >
            Disconnect
          </Button>
        ) : (
          <Button
            onClick={connectToSlack}
            disabled={isConnecting}
          >
            {isConnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Connect to Slack
          </Button>
        )}
      </div>

      {isConnected && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="slack-channel">Select a channel for notifications</Label>
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="h-9 w-[240px] px-2 justify-between whitespace-nowrap rounded-md py-2 text-sm bg-transparent data-[placeholder]:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-2 [&>span]:line-clamp-1 [&>span]:flex [&>span]:items-center [&>span]:gap-1 [&>span]:truncate [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 border border-input"
                    disabled={isLoadingChannels || channels.length === 0}
                  >
                    <span style={{ pointerEvents: 'none' }}>
                      {selectedChannelId ? (
                        <span>#{channels.find(c => c.id === selectedChannelId)?.name || ''}</span>
                      ) : (
                        <span className="text-muted-foreground">Select channel</span>
                      )}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  className="w-[240px]" 
                  style={{
                    outline: "none",
                    pointerEvents: "auto"
                  }}
                  align="start"
                >
                  <div className="max-h-[300px] overflow-y-auto">
                    {channels.length > 0 ? (
                      channels.map((channel) => (
                        <DropdownMenuItem
                          key={channel.id}
                          className={`cursor-pointer flex justify-between group hover:bg-accent`}
                          onClick={() => onChannelSelect && onChannelSelect(channel.id)}
                        >
                          <span className="truncate max-w-[180px]">
                            #{channel.name}
                          </span>
                          <div className="flex items-center">
                            {selectedChannelId === channel.id && (
                              <Check className="h-4 w-4 ml-1 shrink-0" />
                            )}
                          </div>
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                        No channels available. Try refreshing or check your Slack workspace.
                      </div>
                    )}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button 
                variant="outline" 
                size="icon"
                onClick={onRefreshChannels}
                disabled={isLoadingChannels}
                className="h-9 w-9"
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
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md flex items-start">
                <AlertCircle className="h-5 w-5 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-800">
                    Important: Select Slack channel
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    Selecting a channel is required to enable Slack notifications.
                  </p>
                </div>
              </div>
            )}
            <p className="text-xs text-slate-500 mt-1">
              <strong>Note:</strong> For private channels, you'll need to invite the Userbird bot by typing <code className="bg-slate-100 px-1 rounded">/invite @Userbird</code> in the channel. Public channels should work automatically.
            </p>
          </div>
        </div>
      )}
    </div>
  );
} 