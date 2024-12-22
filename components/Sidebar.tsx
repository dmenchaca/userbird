import React, { useState } from 'react';
import { Bird, Search, Plus, LifeBuoy, Send, ChevronDown, MoreHorizontal, ArrowDownUp, Brush, Download, X, Image, ChevronRight } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

interface UserData {
  id: string;
  email: string;
  name: string;
  message: string;
  timestamp: string;
  browser: string;
  os: string;
  screenSize: 'Desktop' | 'Mobile' | 'Tablet';
  images: number;
}

export default function Sidebar() {
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);

  const users: UserData[] = [
    {
      id: 'USR001',
      email: 'john.doe@example.com',
      name: 'John Doe',
      message: 'Having trouble with the login page',
      timestamp: '2024-12-22 17:30:00',
      browser: 'Chrome 120.0',
      os: 'macOS Sonoma',
      screenSize: 'Desktop',
      images: 2
    },
    {
      id: 'USR002',
      email: 'sarah.smith@example.com',
      name: 'Sarah Smith',
      message: 'Cannot upload profile picture',
      timestamp: '2024-12-22 17:25:00',
      browser: 'Safari 17.0',
      os: 'iOS 17',
      screenSize: 'Mobile',
      images: 1
    },
    {
      id: 'USR003',
      email: 'mike.brown@example.com',
      name: 'Mike Brown',
      message: 'Dashboard not loading correctly',
      timestamp: '2024-12-22 17:20:00',
      browser: 'Firefox 121.0',
      os: 'Windows 11',
      screenSize: 'Desktop',
      images: 3
    },
    {
      id: 'USR004',
      email: 'emma.wilson@example.com',
      name: 'Emma Wilson',
      message: 'Payment failed to process',
      timestamp: '2024-12-22 17:15:00',
      browser: 'Edge 120.0',
      os: 'Windows 10',
      screenSize: 'Tablet',
      images: 0
    },
    {
      id: 'USR005',
      email: 'alex.johnson@example.com',
      name: 'Alex Johnson',
      message: 'Need help with settings',
      timestamp: '2024-12-22 17:10:00',
      browser: 'Chrome 120.0',
      os: 'Android 14',
      screenSize: 'Mobile',
      images: 1
    },
  ];

  return (
    <div className="flex h-screen">
      <aside className="w-64 bg-gray-50 border-r border-gray-200">
        <div className="h-full flex flex-col">
          <div className="px-4 py-4">
            <div className="flex items-center space-x-2">
              <Bird className="h-5 w-5" />
              <span className="font-semibold text-lg">Userbird</span>
            </div>
          </div>

          <div className="px-3 mb-4">
            <Input 
              placeholder="Search"
              className="w-full"
              icon={<Search className="h-4 w-4 text-gray-500" />}
            />
          </div>

          <div className="px-2 py-2">
            <div className="text-sm font-medium text-gray-500 px-2 py-2">Forms</div>
            <div className="space-y-1">
              <Button variant="ghost" className="w-full justify-start">
                <span>Family Recipe Collection</span>
                <span className="ml-auto text-xs">23</span>
              </Button>
              <Button variant="ghost" className="w-full justify-start">
                <Plus className="h-4 w-4 mr-2" />
                <span className="text-sm">New form</span>
              </Button>
            </div>
          </div>

          <div className="mt-auto">
            <div className="px-2 py-2">
              <div className="space-y-1">
                <Button variant="ghost" className="w-full justify-start">
                  <LifeBuoy className="h-4 w-4 mr-2" />
                  <span className="text-sm">Support</span>
                </Button>
                <Button variant="ghost" className="w-full justify-start">
                  <Send className="h-4 w-4 mr-2" />
                  <span className="text-sm">Feedback</span>
                </Button>
              </div>
            </div>

            <div className="p-2">
              <Button variant="ghost" className="w-full flex items-center px-2 py-2">
                <Avatar className="h-8 w-8 mr-2" />
                <div className="flex flex-col items-start">
                  <span className="font-semibold text-sm">shadcn</span>
                  <span className="text-xs text-gray-500">m@example.com</span>
                </div>
                <ChevronDown className="h-4 w-4 ml-auto opacity-50" />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-12 border-b flex items-center px-4 py-2 justify-between">
          <div className="text-sm">Family Recipe Collection</div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              <Brush className="h-4 w-4 mr-2" />
              Style
            </Button>
            <Button size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export  
            </Button>
          </div>
        </header>

        <div className="p-4 overflow-auto">
          <div className="space-y-4">
            <div className="flex justify-between">
              <Input placeholder="Search users" className="w-96" />
              <Button variant="outline">
                Filter
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </div>

            <div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px] sticky left-0 bg-white">User ID</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Browser</TableHead>
                    <TableHead>OS</TableHead>
                    <TableHead>Screen</TableHead>
                    <TableHead className="text-center">Images</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow 
                      key={user.id} 
                      onClick={() => setSelectedUser(user)}
                      className="group"
                    >
                      <TableCell className="font-medium sticky left-0 bg-white">
                        <div className="flex items-center">
                          {user.id}
                          <ChevronRight className="h-4 w-4 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.name}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{user.message}</TableCell>
                      <TableCell>{user.timestamp}</TableCell>
                      <TableCell>{user.browser}</TableCell>
                      <TableCell>{user.os}</TableCell>
                      <TableCell>{user.screenSize}</TableCell>
                      <TableCell className="text-center">
                        {user.images > 0 ? (
                          <div className="flex items-center justify-center gap-1">
                            <Image className="h-4 w-4" />
                            <span>{user.images}</span>
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Showing 5 of 10 results</p>
              <div className="flex space-x-2">
                <Button variant="outline">Previous</Button>
                <Button variant="outline">Next</Button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Sheet open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <style jsx global>{`
          .table-sheet {
            --overlay-background: rgba(0, 0, 0, 0) !important;
          }
        `}</style>
        <SheetContent
          className="w-[400px] sm:w-[540px] table-sheet"
          style={{
            transition: 'transform 0.2s ease-out',
            transform: selectedUser ? 'translateX(0)' : 'translateX(100%)',
          }}
        >
          <SheetHeader>
            <SheetTitle>User Details</SheetTitle>
            <SheetDescription>
              View detailed information about the selected user.
            </SheetDescription>
          </SheetHeader>
          {selectedUser && (
            <div className="mt-6 space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500">User ID</h3>
                <p className="mt-1 text-sm">{selectedUser.id}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Name</h3>
                <p className="mt-1 text-sm">{selectedUser.name}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Email</h3>
                <p className="mt-1 text-sm">{selectedUser.email}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Message</h3>
                <p className="mt-1 text-sm">{selectedUser.message}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">System Info</h3>
                <div className="mt-1 space-y-1 text-sm">
                  <p>Browser: {selectedUser.browser}</p>
                  <p>OS: {selectedUser.os}</p>
                  <p>Screen Size: {selectedUser.screenSize}</p>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Timestamp</h3>
                <p className="mt-1 text-sm">{selectedUser.timestamp}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Attached Images</h3>
                <p className="mt-1 text-sm">{selectedUser.images} images</p>
              </div>
            </div>
          )}
          <Button 
            className="mt-6" 
            variant="outline" 
            onClick={() => setSelectedUser(null)}
          >
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
        </SheetContent>
      </Sheet>
    </div>
  );
}

