import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import { useState, useEffect, useRef } from 'react'
import { Bold, Italic, Underline as UnderlineIcon, Link as LinkIcon, Quote, List, ListOrdered } from 'lucide-react'
import { cn } from "@/lib/utils"
import { Extension } from '@tiptap/core'
import { DivParagraph } from './custom-paragraph'

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
  const sendButtonRef = useRef<HTMLButtonElement | null>(null)
  
  // Debug line breaks when value changes
  useEffect(() => {
    if (value) {
      console.log("=== TIPTAP: Received new content ===");
      console.log(`Raw value (${value.length} chars):`);
      console.log(value.replace(/\n/g, "\\n"));
      console.log(`Line breaks count: ${(value.match(/\n/g) || []).length}`);
    }
  }, [value]);
  
  // Create a custom extension to handle Cmd/Ctrl+Enter
  const KeyboardShortcutExt = Extension.create({
    name: 'keyboardShortcuts',
    addKeyboardShortcuts() {
      return {
        'Mod-Enter': () => {
          console.log('Tiptap extension detected Mod-Enter shortcut');
          
          // Simply click the send button programmatically if we have one
          if (sendButtonRef.current) {
            console.log('Clicking the send button programmatically');
            sendButtonRef.current.click();
            return true;
          }
          
          // Fallback to the event handler approach
          if (onKeyDown) {
            console.log('Extension falling back to event handler');
            
            // Create a synthetic keyboard event
            const fakeEvent = {
              preventDefault: () => {
                console.log('preventDefault called in mock event');
              },
              stopPropagation: () => {
                console.log('stopPropagation called in mock event');
              },
              key: 'Enter',
              ctrlKey: !/Mac|iPod|iPhone|iPad/.test(navigator.platform),
              metaKey: /Mac|iPod|iPhone|iPad/.test(navigator.platform)
            } as React.KeyboardEvent;
            
            // Call the parent handler
            onKeyDown(fakeEvent);
          }
          
          return true; // Prevents default behavior completely
        }
      }
    }
  });
  
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        horizontalRule: false,
        paragraph: false,
      }),
      DivParagraph,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      Underline,
      KeyboardShortcutExt,
    ],
    content: value,
    onUpdate: ({ editor }) => {
      const htmlContent = editor.getHTML();
      console.log("=== TIPTAP: Content updated ===");
      console.log(`HTML output: ${htmlContent.replace(/\n/g, "\\n")}`);
      console.log(`HTML line breaks: ${(htmlContent.match(/\n/g) || []).length}`);
      console.log(`<br> tags count: ${(htmlContent.match(/<br\s*\/?>/g) || []).length}`);
      console.log(`<div> tags count: ${(htmlContent.match(/<div/g) || []).length}`);
      onChange(htmlContent);
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

  // Expose the send button ref to parent components
  useEffect(() => {
    // Find the send button in the DOM and store its reference
    // This is a bit hacky but safer than modifying the parent component structure
    const sendBtn = document.querySelector('button:has(.lucide-send)') as HTMLButtonElement | null;
    if (sendBtn && sendButtonRef.current !== sendBtn) {
      // Using mutable ref pattern instead of direct assignment
      sendButtonRef.current = sendBtn;
    }
  }, []);

  // Sync content when value prop changes from outside
  useEffect(() => {
    if (editor && editor.getHTML() !== value) {
      console.log("=== TIPTAP: Setting content from prop ===");
      console.log(`Setting value (${value.length} chars):`);
      console.log(value.replace(/\n/g, "\\n"));
      
      // Improved line break handling
      // The key is to use a consistent paragraph structure that TipTap will render correctly
      let contentWithPreservedLineBreaks = value;
      
      // Replace double newlines with appropriate structure for paragraph breaks
      // This creates a clean paragraph break without excess spacing
      contentWithPreservedLineBreaks = contentWithPreservedLineBreaks
        .replace(/\n\n/g, '</div><div>');
      
      // Handle any remaining single newlines as line breaks within paragraphs
      contentWithPreservedLineBreaks = contentWithPreservedLineBreaks
        .replace(/\n/g, '<br>');
      
      // Wrap in a div to ensure proper structure
      contentWithPreservedLineBreaks = `<div>${contentWithPreservedLineBreaks}</div>`;
      
      console.log("Content after line break preservation:");
      console.log(contentWithPreservedLineBreaks);
      
      editor.commands.setContent(contentWithPreservedLineBreaks);
    }
  }, [value, editor])

  // Regular keydown handler for all other keys
  const handleKeyDown = (event: React.KeyboardEvent) => {
    console.log('TiptapEditor handleKeyDown triggered', { 
      key: event.key, 
      ctrl: event.ctrlKey, 
      meta: event.metaKey 
    });
    
    // No need to handle Cmd/Ctrl+Enter here - it's handled by our extension
    if (onKeyDown && !((event.ctrlKey || event.metaKey) && event.key === 'Enter')) {
      console.log('Forwarding non-shortcut key event to parent');
      onKeyDown(event);
    } else if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      console.log('Mod+Enter detected in handleKeyDown (should be handled by extension)');
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