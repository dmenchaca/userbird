import { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react'
import { Paperclip, Send, CornerDownLeft, Command, MoreHorizontal, UserPlus, Sparkles } from 'lucide-react'
import { Button } from './ui/button'

export const ConversationThread = forwardRef<ConversationThreadRef, ConversationThreadProps>(
  ({ response, onStatusChange, collaborators = [] }, ref) => {
    if (!response) return null
    
    const [replyContent, setReplyContent] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isGeneratingAIReply, setIsGeneratingAIReply] = useState(false)
    const [aiReplyGenController, setAiReplyGenController] = useState<AbortController | null>(null)

    const generateAIReply = async () => {
      if (isGeneratingAIReply || isSubmitting) return;
      
      setReplyContent('');
      setIsGeneratingAIReply(true);
      
      try {
        const controller = new AbortController();
        setAiReplyGenController(controller);
        
        const response = await fetch('/api/generate-reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ feedback_id: response.id }),
          signal: controller.signal
        });
        
        if (!response.ok) {
          throw new Error(`Failed to generate reply: ${response.statusText}`);
        }
        
        if (!response.body) {
          throw new Error('No response body from AI generation');
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let accumulatedContent = '';
        
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            break;
          }
          
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.substring(6);
              
              if (data === '[DONE]') {
                continue;
              }
              
              accumulatedContent += data;
              setReplyContent(accumulatedContent);
            } else if (line.startsWith('event: error')) {
              console.error('Error in AI generation:', line);
              throw new Error('Error generating AI reply');
            } else if (line.startsWith('event: done')) {
              console.log('AI generation complete');
            }
          }
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Error generating AI reply:', error);
        }
      } finally {
        setIsGeneratingAIReply(false);
        setAiReplyGenController(null);
      }
    };
    
    const cancelAIReplyGeneration = () => {
      if (aiReplyGenController) {
        aiReplyGenController.abort();
        setAiReplyGenController(null);
        setIsGeneratingAIReply(false);
      }
    };

    return (
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2 px-1 py-2">
          {!isGeneratingAIReply ? (
            <Button
              onClick={generateAIReply}
              variant="outline"
              size="sm"
              className="flex items-center gap-1 text-xs"
              disabled={isSubmitting || isGeneratingAIReply}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Generate
            </Button>
          ) : (
            <Button
              onClick={cancelAIReplyGeneration}
              variant="outline"
              size="sm"
              className="flex items-center gap-1 text-xs text-destructive"
            >
              Cancel
            </Button>
          )}
        </div>

        <div className="flex items-center space-x-2 px-1 py-2">
          {/* Existing send button and keyboard shortcut info */}
        </div>
      </div>
    );
  }
); 