import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { acceptInvitationById } from '@/lib/utils/invitations';

export function FixInvitation() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  const fixSpecificInvitation = async () => {
    setLoading(true);
    try {
      // This is the ID from the invitation you showed
      const invitationId = '573f92ad-7a7b-4b8e-83a1-08364d443ef0';
      const result = await acceptInvitationById(invitationId);
      setResult(result);
    } catch (error) {
      console.error('Error:', error);
      setResult({ error });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Fix Invitation</h1>
      
      <div className="mb-4">
        <p>This page will fix the invitation for hi+8@diego.bio</p>
        <p className="text-muted-foreground text-sm">Invitation ID: 573f92ad-7a7b-4b8e-83a1-08364d443ef0</p>
      </div>
      
      <Button 
        onClick={fixSpecificInvitation}
        disabled={loading}
      >
        {loading ? 'Fixing...' : 'Accept Invitation'}
      </Button>
      
      {result && (
        <div className="mt-4 p-4 border rounded-md">
          <h2 className="font-bold mb-2">Result:</h2>
          <pre className="bg-gray-100 p-2 rounded text-sm overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
} 