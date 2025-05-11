import { MoreVertical, ArrowUpRight, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AreaChart, Area, XAxis, ResponsiveContainer } from 'recharts'
import { Avatar } from '@/components/ui/avatar'
import { useEffect, useRef } from 'react'

const sessionData = [
  { name: 'Mon', value: 2.4 },
  { name: 'Tue', value: 2.8 },
  { name: 'Wed', value: 2.2 },
  { name: 'Thu', value: 3.1 },
  { name: 'Fri', value: 2.6 },
  { name: 'Sat', value: 2.9 },
  { name: 'Sun', value: 3.2 }
];

const pagesData = [
  { name: 'Mon', value: 280 },
  { name: 'Tue', value: 300 },
  { name: 'Wed', value: 260 },
  { name: 'Thu', value: 340 },
  { name: 'Fri', value: 290 },
  { name: 'Sat', value: 320 },
  { name: 'Sun', value: 360 }
];

export function AnalyticsDashboard() {
  const feedbackButtonRef = useRef<HTMLButtonElement>(null);

  // Initialize the Userbird widget using plain JS
  useEffect(() => {
    // Check if the Userbird script already exists to avoid duplicates
    if (!document.querySelector('script[src="https://userbird.netlify.app/widget.js"]')) {
      // Initialize Userbird using HTML/JS approach
      const formId = "4hNUB7DVhf";
      
      // First set up the UserBird object
      window.UserBird = window.UserBird || {};
      // Use type assertion to set properties
      (window.UserBird as any).formId = formId;
      
      // Create and append the script
      const script = document.createElement('script');
      script.src = 'https://userbird.netlify.app/widget.js';
      script.onload = () => {
        console.log('Userbird widget loaded successfully via HTML/JS implementation');
      };
      script.onerror = () => {
        console.error('Failed to load Userbird widget');
      };
      document.head.appendChild(script);
    }
  }, []);
  
  return (
    <Card className="relative bg-white/50 rounded-lg shadow-lg overflow-hidden">
      {/* Browser Address Bar */}
      <div className="relative h-9 bg-background/60 backdrop-blur-sm border-b border-border/40 flex items-center px-3 rounded-t-lg">
        {/* Traffic Light Buttons */}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#FF5F56] hover:opacity-90 transition-opacity cursor-pointer" />
          <div className="w-3 h-3 rounded-full bg-[#FFBD2E] hover:opacity-90 transition-opacity cursor-pointer" />
          <div className="w-3 h-3 rounded-full bg-[#27C93F] hover:opacity-90 transition-opacity cursor-pointer" />
        </div>
        
        {/* URL Field */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2 py-0.5 bg-muted/50 backdrop-blur-sm border border-border/20 rounded-md w-48 justify-center shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <Lock className="h-2.5 w-2.5 text-[#6b7280]/60" />
          <span className="text-xs text-[#333]/70 font-medium">your-app.com</span>
        </div>
      </div>
      
      {/* Header */}
      <CardHeader className="space-y-4 p-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <Tabs defaultValue="projects" className="w-auto">
            <TabsList className="grid w-auto grid-cols-4 bg-transparent p-0 text-muted-foreground/50">
              <TabsTrigger
                value="projects"
                className="data-[state=active]:bg-transparent data-[state=active]:text-foreground/50 data-[state=active]:shadow-none px-2"
              > 
                Projects
              </TabsTrigger>
              <TabsTrigger
                value="tasks"
                className="data-[state=active]:bg-transparent data-[state=active]:text-foreground/50 data-[state=active]:shadow-none"
              >
                Tasks
              </TabsTrigger>
              <TabsTrigger
                value="reporting"
                className="data-[state=active]:bg-transparent data-[state=active]:text-foreground/50 data-[state=active]:shadow-none"
              >
                Reporting
              </TabsTrigger>
              <TabsTrigger
                value="users"
                className="data-[state=active]:bg-transparent data-[state=active]:text-foreground/50 data-[state=active]:shadow-none"
              >
                Users
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2">
            {/* HTML/JS implementation of the Feedback button */}
            <button 
              id="userbird-trigger-4hNUB7DVhf"
              ref={feedbackButtonRef}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:text-accent-foreground py-2 gap-2 h-9 px-3 relative z-[3] transition-all duration-200 hover:bg-white/50 hover:border-border/60 hover:shadow-sm"
            >
              <span className="pointer-events-none">Feedback</span>
              <span className="px-1.5 py-0.5 text-xs rounded bg-muted text-muted-foreground pointer-events-none">F</span>
            </button>
            <Avatar className="h-8 w-8 opacity-50">
              <img
                src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=256&h=256&q=80"
                alt="Profile"
                className="h-full w-full object-cover rounded-full"
              />
            </Avatar>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Tabs defaultValue="all" className="w-auto">
            <TabsList className="grid w-auto grid-cols-4 bg-transparent p-0 text-muted-foreground/50">
              <TabsTrigger
                value="all"
                className="text-xs data-[state=active]:bg-transparent data-[state=active]:text-foreground/50 data-[state=active]:shadow-none"
              >
                All traffic
              </TabsTrigger>
              <TabsTrigger
                value="paid"
                className="text-xs data-[state=active]:bg-transparent data-[state=active]:text-foreground/50 data-[state=active]:shadow-none"
              >
                Paid traffic
              </TabsTrigger>
              <TabsTrigger
                value="mobile"
                className="text-xs data-[state=active]:bg-transparent data-[state=active]:text-foreground/50 data-[state=active]:shadow-none"
              >
                Mobile users
              </TabsTrigger>
              <TabsTrigger
                value="returning"
                className="text-xs data-[state=active]:bg-transparent data-[state=active]:text-foreground/50 data-[state=active]:shadow-none"
              >
                Returning users
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs px-2.5 opacity-50">
              Export report
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Time filters */}
      <div className="hidden 2xl:flex items-center justify-end gap-2 p-4 border-b border-border/50">
        <Tabs defaultValue="12m" className="w-auto">
          <TabsList className="bg-transparent p-0 text-muted-foreground/50">
            <TabsTrigger
              value="12m"
              className="text-xs data-[state=active]:bg-transparent data-[state=active]:text-foreground/50 data-[state=active]:shadow-none"
            >
              12m
            </TabsTrigger>
            <TabsTrigger
              value="30d"
              className="text-xs data-[state=active]:bg-transparent data-[state=active]:text-foreground/50 data-[state=active]:shadow-none"
            >
              30d
            </TabsTrigger>
            <TabsTrigger
              value="7d"
              className="text-xs data-[state=active]:bg-transparent data-[state=active]:text-foreground/50 data-[state=active]:shadow-none"
            >
              7d
            </TabsTrigger>
            <TabsTrigger
              value="24h"
              className="text-xs data-[state=active]:bg-transparent data-[state=active]:text-foreground/50 data-[state=active]:shadow-none"
            >
              24h
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Stats grid */}
      <CardContent className="grid grid-cols-2 gap-4 p-4">
        <Card className="border border-border/50 shadow-none bg-white/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-muted-foreground/50">Session duration</span>
              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-50">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl font-semibold tracking-tight opacity-50">2:24</span>
              <div className="flex items-center text-sm text-emerald-500/50 font-medium">
                <ArrowUpRight className="h-4 w-4 mr-1" />
                8.6%
                <span className="text-muted-foreground/50 font-normal ml-1">vs last month</span>
              </div>
            </div>
            <div className="h-[100px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sessionData}>
                  <defs>
                    <linearGradient id="sessionGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgb(16, 185, 129)" stopOpacity={0.1} />
                      <stop offset="100%" stopColor="rgb(16, 185, 129)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12, fill: '#6b7280', opacity: 0.5 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="rgb(16, 185, 129, 0.5)"
                    strokeWidth={2}
                    fill="url(#sessionGradient)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/50 shadow-none bg-white/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-muted-foreground/50">Pages per session</span>
              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-50">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl font-semibold tracking-tight opacity-50">316</span>
              <div className="flex items-center text-sm text-emerald-500/50 font-medium">
                <ArrowUpRight className="h-4 w-4 mr-1" />
                6.0%
                <span className="text-muted-foreground/50 font-normal ml-1">vs last month</span>
              </div>
            </div>
            <div className="h-[100px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={pagesData}>
                  <defs>
                    <linearGradient id="pagesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgb(16, 185, 129)" stopOpacity={0.1} />
                      <stop offset="100%" stopColor="rgb(16, 185, 129)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12, fill: '#6b7280', opacity: 0.5 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="rgb(16, 185, 129, 0.5)"
                    strokeWidth={2}
                    fill="url(#pagesGradient)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  )
}