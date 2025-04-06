import { useState, useEffect } from 'react'
import { Mail, Check, Copy, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'

type DNSRecord = {
  id: string
  record_type: string
  record_name: string
  record_value: string
  verified: boolean
  failure_reason?: string
  last_check_time?: string
}

type CustomEmailSettings = {
  id: string
  custom_email: string
  domain: string
  local_part: string
  forwarding_address: string
  verified: boolean
  verification_status: 'unverified' | 'pending' | 'verified' | 'failed'
  spf_verified: boolean
  dkim_verified: boolean
  dmarc_verified: boolean
  verification_messages?: string[]
}

type CustomEmailTabProps = {
  formId: string
}

export function CustomEmailTab({ formId }: CustomEmailTabProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [customEmail, setCustomEmail] = useState('')
  const [settings, setSettings] = useState<CustomEmailSettings | null>(null)
  const [dnsRecords, setDnsRecords] = useState<DNSRecord[]>([])
  const [hasSettings, setHasSettings] = useState(false)
  const [savingEmail, setSavingEmail] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [verifyingDns, setVerifyingDns] = useState<boolean>(false)

  const fetchCustomEmailSettings = async () => {
    setIsLoading(true)
    
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) throw sessionError
      
      const token = sessionData.session?.access_token
      
      if (!token) {
        throw new Error('No authentication token found')
      }
      
      const response = await fetch(`/.netlify/functions/custom-email-settings?formId=${formId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch custom email settings')
      }
      
      const data = await response.json()
      
      console.log('Custom email settings:', data.settings)
      
      setSettings(data.settings)
      setDnsRecords(data.dnsRecords || [])
      setHasSettings(!!data.settings)
      
      if (data.settings) {
        setCustomEmail(data.settings.custom_email)
      }
    } catch (error) {
      console.error('Error fetching custom email settings:', error)
      toast.error('Failed to load custom email settings')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (formId) {
      fetchCustomEmailSettings()
    }
  }, [formId])

  const handleSaveCustomEmail = async () => {
    if (!formId) return
    
    if (!validateEmail()) {
      return
    }
    
    setSavingEmail(true)
    
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) throw sessionError
      
      const token = sessionData.session?.access_token
      
      if (!token) {
        throw new Error('No authentication token found')
      }
      
      const url = hasSettings 
        ? `/.netlify/functions/custom-email-settings?formId=${formId}`
        : `/.netlify/functions/custom-email-settings?formId=${formId}`
      
      const method = hasSettings ? 'PUT' : 'POST'
      const body = hasSettings 
        ? JSON.stringify({ id: settings?.id, custom_email: customEmail })
        : JSON.stringify({ custom_email: customEmail })
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save custom email')
      }
      
      const data = await response.json()
      
      setSettings(data.settings)
      setDnsRecords(data.dnsRecords || [])
      setHasSettings(true)
      
      toast.success(`Custom email ${hasSettings ? 'updated' : 'saved'} successfully`)
    } catch (error) {
      console.error('Error saving custom email:', error)
      toast.error(`Failed to ${hasSettings ? 'update' : 'save'} custom email`)
    } finally {
      setSavingEmail(false)
    }
  }

  const handleDeleteCustomEmail = async () => {
    if (!settings?.id) return
    
    if (!confirm('Are you sure you want to delete this custom email configuration?')) {
      return
    }
    
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) throw sessionError
      
      const token = sessionData.session?.access_token
      
      if (!token) {
        throw new Error('No authentication token found')
      }
      
      const response = await fetch(`/.netlify/functions/custom-email-settings?formId=${formId}&id=${settings.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to delete custom email')
      }
      
      setSettings(null)
      setDnsRecords([])
      setHasSettings(false)
      setCustomEmail('')
      
      toast.success('Custom email deleted successfully')
    } catch (error) {
      console.error('Error deleting custom email:', error)
      toast.error('Failed to delete custom email')
    }
  }

  const validateEmail = () => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    
    if (!customEmail) {
      setEmailError('Email is required')
      return false
    }
    
    if (!emailRegex.test(customEmail)) {
      setEmailError('Please enter a valid email address')
      return false
    }
    
    setEmailError('')
    return true
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  const getStatusBadge = (status: string, verified: boolean) => {
    if (verified) {
      return <Badge className="bg-green-500">Verified</Badge>
    }
    
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-500">Pending verification</Badge>
      case 'failed':
        return <Badge className="bg-red-500">Verification failed</Badge>
      default:
        return <Badge className="bg-slate-500">Not verified</Badge>
    }
  }

  const handleVerifyDns = async () => {
    if (!settings?.id) return
    
    setVerifyingDns(true)
    
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) throw sessionError
      
      const token = sessionData.session?.access_token
      
      if (!token) {
        throw new Error('No authentication token found')
      }
      
      const response = await fetch(
        `/.netlify/functions/verify-dns-records`, 
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ settingsId: settings.id })
        }
      )
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify DNS records')
      }
      
      if (data.verified) {
        toast.success('DNS records verified successfully!')
        fetchCustomEmailSettings()
      } else {
        toast.error('Some DNS records failed verification. Please check the details below.')
        fetchCustomEmailSettings()
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to verify DNS records')
    } finally {
      setVerifyingDns(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex gap-2 items-center">
          <Mail className="h-5 w-5" />
          <h3 className="text-lg font-medium">Custom Email Address</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Personalize your feedback communication by using your own domain for sending emails.
        </p>
      </div>
      
      <Separator className="my-4" />
      
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      ) : !hasSettings ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="customEmail">Email address</Label>
            <div className="flex gap-2">
              <Input
                id="customEmail"
                value={customEmail}
                onChange={(e) => {
                  setCustomEmail(e.target.value)
                  if (emailError) validateEmail()
                }}
                placeholder="feedback@yourdomain.com"
                className={emailError ? 'border-red-500' : ''}
              />
              <Button 
                onClick={handleSaveCustomEmail}
                disabled={savingEmail}
              >
                {savingEmail ? 'Saving...' : 'Save'}
              </Button>
            </div>
            {emailError && (
              <p className="text-sm text-red-500 mt-1">{emailError}</p>
            )}
            <p className="text-sm text-muted-foreground">
              This email will be used as the sender for all notifications from this form.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-slate-50 p-6 rounded-lg">
            <h1 className="text-lg font-medium mb-2">Configuration settings for {settings?.custom_email}</h1>
            <p className="text-sm text-muted-foreground mb-6">
              You'll need to configure your domain name to be able to receive and send emails from {settings?.domain}.
            </p>
            
            <div className="space-y-6">
              <section>
                <h3 className="font-medium mb-2">1. Create an email redirect</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create an email redirection in order to receive emails on Userbird. You would usually find this option on the panel of your domain name registrar.
                </p>
                
                <Card>
                  <CardContent className="p-4">
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th className="text-left font-medium text-muted-foreground text-sm w-1/2">From</th>
                          <th className="text-left font-medium text-muted-foreground text-sm w-1/2">To</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="py-2 font-mono text-sm">{settings?.custom_email}</td>
                          <td className="py-2">
                            <div className="flex items-center gap-2">
                              <code className="text-sm font-mono">{settings?.forwarding_address}</code>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-6 w-6" 
                                onClick={() => copyToClipboard(settings?.forwarding_address || '')}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </section>
              
              <section>
                <h3 className="font-medium mb-2">2. Authenticate your ownership of {settings?.domain}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Now, give Userbird permission to send emails on your behalf by authenticating this domain. Add the following DNS entries in your domain settings.
                </p>
                
                <div className="bg-blue-50 border border-blue-100 p-3 rounded-md mb-4">
                  <p className="text-sm text-blue-700 flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M12 16v-4"/>
                      <path d="M12 8h.01"/>
                    </svg>
                    DNS changes can take up to 24-48 hours to propagate. After adding the records, click "Verify Now" to check if they've been properly configured.
                  </p>
                </div>
                
                {dnsRecords.map((record) => (
                  <Card key={record.id} className="mb-4">
                    <CardContent className="p-4 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                        <div className="flex items-center gap-2 mb-2 sm:mb-0">
                          <strong className="text-sm">Type</strong>
                          <span className="text-sm font-mono">{record.record_type}</span>
                        </div>
                        <div className="flex justify-end">
                          {record.verified ? (
                            <Badge className="bg-green-500 gap-1 text-white">
                              <Check className="h-3 w-3" /> Configured
                            </Badge>
                          ) : (
                            <Badge className="bg-red-500 gap-1 text-white">
                              <AlertTriangle className="h-3 w-3" /> Not configured yet
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <strong className="text-sm">Name/Host</strong>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="text-sm font-mono bg-slate-100 p-1 rounded flex-1 overflow-auto">
                            {record.record_name}
                          </code>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-6 w-6" 
                            onClick={() => copyToClipboard(record.record_name)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      
                      <div>
                        <strong className="text-sm">Value</strong>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="text-sm font-mono bg-slate-100 p-1 rounded flex-1 overflow-auto break-all">
                            {record.record_value}
                          </code>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-6 w-6" 
                            onClick={() => copyToClipboard(record.record_value)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      
                      {record.failure_reason && !record.verified && (
                        <div className="text-sm text-red-500 mt-2 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {record.failure_reason}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
                
                <div className="mt-6 flex items-center gap-2">
                  <span className="text-sm font-medium">Domain Verification Status:</span>
                  {getStatusBadge(settings?.verification_status || 'unverified', settings?.verified || false)}
                  
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={handleVerifyDns} 
                    disabled={verifyingDns}
                    className="ml-2"
                  >
                    {verifyingDns ? 'Verifying...' : 'Verify Now'}
                  </Button>
                </div>
                
                {settings?.verification_messages && settings.verification_messages.length > 0 && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <h4 className="text-sm font-medium text-red-700 flex items-center gap-1 mb-2">
                      <AlertTriangle className="h-3 w-3" />
                      Verification Issues
                    </h4>
                    <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                      {settings.verification_messages.map((msg, i) => (
                        <li key={i}>{msg}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            </div>
          </div>
          
          <div className="flex justify-between items-center">
            <div className="space-y-2">
              <Label htmlFor="customEmailUpdate">Update Email Address</Label>
              <div className="flex gap-2">
                <Input
                  id="customEmailUpdate"
                  value={customEmail}
                  onChange={(e) => {
                    setCustomEmail(e.target.value)
                    if (emailError) validateEmail()
                  }}
                  className={emailError ? 'border-red-500' : ''}
                />
                <Button 
                  onClick={handleSaveCustomEmail}
                  disabled={savingEmail}
                  variant="secondary"
                >
                  {savingEmail ? 'Updating...' : 'Update'}
                </Button>
              </div>
              {emailError && (
                <p className="text-sm text-red-500">{emailError}</p>
              )}
            </div>
            
            <Button 
              onClick={handleDeleteCustomEmail}
              variant="destructive"
            >
              Delete Configuration
            </Button>
          </div>
        </div>
      )}
    </div>
  )
} 