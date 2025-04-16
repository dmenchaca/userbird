# Example of Branded Email Footer

This is an example of how the branded email footer will appear in outbound emails when branding is not disabled:

## HTML Email Footer (Simplified Design)
```html
<div style="font-family: 'system-ui','-apple-system','BlinkMacSystemFont','Segoe UI','Roboto','Oxygen-Sans','Ubuntu','Cantarell','Helvetica Neue','Arial','sans-serif'; font-size: 12px; line-height: 1.5; color: #49545c; margin: 10px 0 14px 0; padding-top: 10px; border-top: 1px solid #e5e7eb;">
  This email is a service from Product Name. Delivered by <a href="https://app.userbird.co/?ref=email&domain=Product%20Name" style="color:black;" target="_blank" rel="noopener noreferrer">Userbird</a>
</div>
```

## Plain Text Email Footer
```
This email is a service from Product Name. Delivered by Userbird (https://app.userbird.co)
```

## Visual Appearance
The footer will appear with a clean, simple design at the bottom of the email, with a subtle gray color and a simple text link to Userbird. The style is inspired by the footer used in Zendesk emails, with a more professional and streamlined appearance.

## Placement in Email
For admin dashboard replies, the footer will now appear right after the reply content and before any previous messages in the thread. This helps make the footer more visible and relevant to the current message, rather than appearing at the very end of a potentially long email thread.

## When It Appears
This branding footer will only appear:
1. In outbound emails sent by admins and agents from the dashboard
2. When the "Remove branding" toggle in the form settings is turned OFF
3. It will NOT appear in system notification emails (like new feedback notifications)

## Form Settings Dialog
The "Remove branding" option in the form settings dialog now includes updated text to clarify that it affects both the widget and outbound emails:
> Remove "We run on Userbird" branding from the widget and outbound emails 