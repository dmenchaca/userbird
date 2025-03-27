import { Button } from './ui/button'
import { Copy, Check } from 'lucide-react'

interface CodeBlockProps {
  id: string
  code: string
  copiedId: string | null
  onCopy: (code: string, id: string) => void
}

export function CodeBlock({ id, code, copiedId, onCopy }: CodeBlockProps) {
  return (
    <div className="relative">
      <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm leading-relaxed font-mono">
        <code>{code}</code>
      </pre>
      <Button
        size="icon"
        variant="ghost"
        className="absolute top-3 right-3 h-6 w-6"
        onClick={() => onCopy(code, id)}
      >
        {copiedId === id ? (
          <Check className="h-3 w-3" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </Button>
    </div>
  )
} 