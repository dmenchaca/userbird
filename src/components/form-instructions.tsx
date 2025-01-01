import { Button } from './ui/button'
import { FeedbackTable } from './feedback-table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { VERSION } from '@/lib/feedback-widget/version'

interface FormInstructionsProps {
  formId: string
  buttonColor: string
}

export function FormInstructions({ formId, buttonColor }: FormInstructionsProps) {
  const scriptUrl = `https://userbird.netlify.app/widget.js?v=${VERSION}`

  return (
    <div className="space-y-6">
      {/* ... existing JSX ... */}
      <TabsContent value="script" className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Script Tag Integration</h3>
          <p className="text-sm text-muted-foreground mb-4">Add this code just before the closing <code>&lt;/body&gt;</code> tag:</p>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
            <code>{`<script>
  (function(w,d,i,s){
    w.UserBird=w.UserBird||function(){};
    w.UserBird.formId="${formId}";
    w.UserBird.buttonColor="${buttonColor}";
    s=d.createElement('script');
    s.src='${scriptUrl}';
    d.head.appendChild(s);
  })(window,document);
</script>`}</code>
          </pre>
        </div>
      </TabsContent>
      {/* ... rest of the component ... */}
    </div>
  )
}