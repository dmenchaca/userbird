import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { Loader } from 'lucide-react';

export function FixInvitation() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [invitation, setInvitation] = useState<any>(null);
  
  // Get user and check invitation on load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
        
        // Get invitation details
        const invitationId = '573f92ad-7a7b-4b8e-83a1-08364d443ef0';
        const { data } = await supabase
          .from('form_collaborators')
          .select('*')
          .eq('id', invitationId)
          .single();
          
        setInvitation(data);
      } catch (error) {
        console.error('Initial load error:', error);
      } finally {
        setInitialLoading(false);
      }
    };
    
    checkAuth();
  }, []);
  
  const fixSpecificInvitation = async () => {
    setLoading(true);
    try {
      // This is the ID from the invitation you showed
      const invitationId = '573f92ad-7a7b-4b8e-83a1-08364d443ef0';
      
      if (!user) {
        throw new Error('Not logged in. Please log in first.');
      }
      
      // First, try to use the Netlify function with admin privileges
      const response = await fetch('/.netlify/functions/fix-invitation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          invitationId: invitationId
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(`Server error: ${data.error || response.statusText}`);
      }
      
      // Update the local state with the response data
      setResult({ success: true, data });
      
      if (data.after) {
        setInvitation(data.after);
      } else {
        // Get the updated record as backup
        const { data: updatedData } = await supabase
          .from('form_collaborators')
          .select('*')
          .eq('id', invitationId)
          .single();
          
        setInvitation(updatedData);
      }
    } catch (error) {
      console.error('Error:', error);
      setResult({ success: false, error });
      
      // Fallback to direct DB update if the function fails
      try {
        console.log('Trying direct database update as fallback...');
        
        const invitationId = '573f92ad-7a7b-4b8e-83a1-08364d443ef0';
        
        const { data, error: updateError } = await supabase
          .from('form_collaborators')
          .update({
            user_id: user.id,
            invitation_accepted: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', invitationId)
          .select();
          
        if (updateError) {
          console.error('Fallback update error:', updateError);
        } else {
          setResult({ success: true, data, method: 'fallback' });
          
          // Refresh invitation data
          const { data: refreshedData } = await supabase
            .from('form_collaborators')
            .select('*')
            .eq('id', invitationId)
            .single();
            
          setInvitation(refreshedData);
        }
      } catch (fallbackError) {
        console.error('Fallback error:', fallbackError);
      }
    } finally {
      setLoading(false);
    }
  };
  
  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader className="w-8 h-8 animate-spin text-blue-500" />
          <p>Loading invitation data...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-4">Fix Invitation</h1>
      
      {!user ? (
        <div className="p-4 bg-yellow-100 text-yellow-800 rounded-md mb-4">
          <p className="font-bold">You need to be logged in!</p>
          <p className="mt-2">Please <a href="/login" className="underline">log in</a> with the email address hi+8@diego.bio first.</p>
        </div>
      ) : (
        <div className="p-4 bg-green-100 text-green-800 rounded-md mb-4">
          <p className="font-bold">Logged in as: {user.email}</p>
          <p className="mt-1 text-sm">User ID: {user.id}</p>
        </div>
      )}
      
      {invitation && (
        <div className="mb-6 p-4 border rounded-md bg-gray-50">
          <h2 className="font-bold mb-2">Current Invitation Status:</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="font-semibold">ID:</div>
            <div>{invitation.id}</div>
            
            <div className="font-semibold">Form ID:</div>
            <div>{invitation.form_id}</div>
            
            <div className="font-semibold">Email:</div>
            <div>{invitation.invitation_email}</div>
            
            <div className="font-semibold">User ID:</div>
            <div className={invitation.user_id ? 'text-green-600 font-medium' : 'text-gray-500'}>
              {invitation.user_id || 'Not set'}
            </div>
            
            <div className="font-semibold">Accepted:</div>
            <div className={invitation.invitation_accepted ? 'text-green-600 font-medium' : 'text-gray-500'}>
              {invitation.invitation_accepted ? 'Yes' : 'No'}
            </div>
            
            <div className="font-semibold">Last Updated:</div>
            <div>{new Date(invitation.updated_at).toLocaleString()}</div>
          </div>
        </div>
      )}
      
      <div className="mb-4">
        <p>This tool will fix the invitation for hi+8@diego.bio by:</p>
        <ul className="list-disc ml-5 mt-2">
          <li>Setting the user_id to your current user ID</li>
          <li>Marking the invitation as accepted</li>
          <li>Updating the timestamp</li>
        </ul>
        <p className="mt-2 text-sm text-gray-600">This will be done with admin privileges bypassing RLS policies.</p>
      </div>
      
      <Button 
        onClick={fixSpecificInvitation}
        disabled={loading || !user}
        className="mb-4"
      >
        {loading ? 'Fixing...' : 'Accept Invitation'}
      </Button>
      
      {result && (
        <div className={`mt-4 p-4 border rounded-md ${result.success ? 'bg-green-50' : 'bg-red-50'}`}>
          <h2 className="font-bold mb-2">Result:</h2>
          <p>{result.success ? 'Invitation successfully linked!' : 'Error linking invitation'}</p>
          <pre className="bg-white p-2 rounded text-sm overflow-auto mt-2 border">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
      
      {result?.success && (
        <div className="mt-4 p-4 bg-blue-100 text-blue-800 rounded-md">
          <p className="font-bold">Success!</p>
          <p className="mt-2">The invitation has been fixed. You can now <a href="/" className="underline">go to your dashboard</a> and see the form.</p>
        </div>
      )}
    </div>
  );
} 