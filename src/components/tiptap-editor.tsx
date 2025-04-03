import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import { useState, useEffect } from 'react'
import { Bold, Italic, Underline as UnderlineIcon, Link as LinkIcon, Quote, List, ListOrdered } from 'lucide-react'
import { cn } from "@/lib/utils"

interface TiptapEditorProps {
  value: string
  onChange: (html: string) => void
  onKeyDown?: (event: React.KeyboardEvent) => void
  placeholder?: string
  className?: string
}

export function TiptapEditor({ value, onChange, onKeyDown, placeholder, className }: TiptapEditorProps) {
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      Underline,
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: cn(
          "min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none",
          className
        ),
      },
    },
  })

  // Sync content when value prop changes from outside
  useEffect(() => {
    if (editor && editor.getHTML() !== value) {
      editor.commands.setContent(value)
    }
  }, [value, editor])

  // Handle key events for Ctrl+Enter
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (onKeyDown) {
      onKeyDown(event)
    }
  }

  // Close the link input when clicking outside of it
  useEffect(() => {
    const handleClickOutside = () => {
      if (showLinkInput) {
        setShowLinkInput(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [showLinkInput])

  if (!editor) {
    return null
  }

  const addLink = () => {
    if (linkUrl) {
      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink({ href: linkUrl })
        .run()
      setLinkUrl('')
      setShowLinkInput(false)
    }
  }

  return (
    <div className="relative" onKeyDown={handleKeyDown}>
      {editor && (
        <BubbleMenu 
          editor={editor}
          tippyOptions={{ duration: 150 }}
          className="flex p-1 bg-background border rounded-md shadow-md gap-1"
        >
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1 rounded hover:bg-muted ${editor.isActive('bold') ? 'bg-muted' : ''}`}
            title="Bold"
          >
            <Bold size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1 rounded hover:bg-muted ${editor.isActive('italic') ? 'bg-muted' : ''}`}
            title="Italic"
          >
            <Italic size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`p-1 rounded hover:bg-muted ${editor.isActive('underline') ? 'bg-muted' : ''}`}
            title="Underline"
          >
            <UnderlineIcon size={16} />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation() // Prevent clicking outside handler
                setShowLinkInput(!showLinkInput)
              }}
              className={`p-1 rounded hover:bg-muted ${editor.isActive('link') ? 'bg-muted' : ''}`}
              title="Link"
            >
              <LinkIcon size={16} />
            </button>
            {showLinkInput && (
              <div 
                className="absolute top-full left-0 mt-1 flex items-center bg-background border rounded shadow-md p-1 z-10"
                onClick={(e) => e.stopPropagation()}
              >
                <input 
                  type="text"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="text-xs border-0 outline-none bg-transparent p-1 w-36"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addLink()
                    }
                  }}
                  autoFocus
                />
                <button 
                  type="button" 
                  onClick={addLink}
                  className="text-xs bg-primary text-primary-foreground p-1 rounded"
                >
                  Add
                </button>
              </div>
            )}
          </div>
          <div className="h-5 w-px bg-muted-foreground/20"></div>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-1 rounded hover:bg-muted ${editor.isActive('bulletList') ? 'bg-muted' : ''}`}
            title="Bullet List"
          >
            <List size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-1 rounded hover:bg-muted ${editor.isActive('orderedList') ? 'bg-muted' : ''}`}
            title="Numbered List"
          >
            <ListOrdered size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`p-1 rounded hover:bg-muted ${editor.isActive('blockquote') ? 'bg-muted' : ''}`}
            title="Quote"
          >
            <Quote size={16} />
          </button>
        </BubbleMenu>
      )}
      <EditorContent editor={editor} />
      {!editor.getText().trim() && placeholder && (
        <div className="absolute top-[9px] left-3 text-muted-foreground text-sm pointer-events-none">
          {placeholder}
        </div>
      )}
    </div>
  )
} 