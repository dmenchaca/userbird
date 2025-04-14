import { mergeAttributes, Node } from '@tiptap/core'

export interface DivParagraphOptions {
  HTMLAttributes: Record<string, any>,
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    divParagraph: {
      /**
       * Toggle a paragraph
       */
      setParagraph: () => ReturnType,
    }
  }
}

export const DivParagraph = Node.create<DivParagraphOptions>({
  name: 'paragraph',

  priority: 1000,

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  group: 'block',

  content: 'inline*',

  parseHTML() {
    return [
      { tag: 'p' },
      { tag: 'div', priority: 100 }, // Higher priority to ensure divs are parsed correctly
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },

  addCommands() {
    return {
      setParagraph: () => ({ commands }) => {
        return commands.setNode(this.name)
      },
    }
  },

  addInputRules() {
    return []
  },
}) 