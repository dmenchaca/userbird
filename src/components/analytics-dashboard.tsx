import { MoreVertical, ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AreaChart, Area, XAxis, ResponsiveContainer } from 'recharts'
import { Avatar } from '@/components/ui/avatar'

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
  return (
    <Card className="relative bg-white/50 rounded-lg shadow-lg overflow-hidden">
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
            <Button 
              id="userbird-trigger-4hNUB7DVhf"
              variant="outline" 
              size="default" 
              className="gap-2 h-9 px-3 relative z-[3] transition-all duration-200 hover:bg-white/50 hover:border-border/60 hover:shadow-sm"
            >
              Feedback
              <span className="px-1.5 py-0.5 text-xs rounded bg-muted text-muted-foreground">L</span>
            </Button>
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
      <div className="flex items-center justify-end gap-2 p-4 border-b border-border/50">
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