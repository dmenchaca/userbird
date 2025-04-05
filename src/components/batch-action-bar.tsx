import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu'
import { Button } from './ui/button'
import { Check, Circle, X } from 'lucide-react'

interface BatchActionBarProps {
  selectedIds: string[]
  onClearSelection: () => void
  onStatusChange: (ids: string[], status: 'open' | 'closed') => void
}

export function BatchActionBar({ selectedIds, onClearSelection, onStatusChange }: BatchActionBarProps) {
  const selectedCount = selectedIds.length
  
  if (selectedCount === 0) return null
  
  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 bg-background border shadow-lg rounded-lg px-4 py-3 flex items-center gap-4">
      <div className="text-sm font-medium">
        {selectedCount} selected
      </div>
      
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              Set Status
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center">
            <DropdownMenuItem 
              className="flex items-center cursor-pointer"
              onClick={() => onStatusChange(selectedIds, 'open')}
            >
              <Circle className="h-3 w-3 mr-2 fill-blue-500 text-blue-500" />
              <span>Open</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="flex items-center cursor-pointer"
              onClick={() => onStatusChange(selectedIds, 'closed')}
            >
              <Check className="h-4 w-4 mr-2 text-green-500" />
              <span>Closed</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <Button 
          variant="ghost" 
          size="sm"
          onClick={onClearSelection}
          className="text-muted-foreground"
        >
          <X className="h-4 w-4 mr-1" />
          Clear Selection
        </Button>
      </div>
    </div>
  )
} 