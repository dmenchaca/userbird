# Example of Branded Email Footer

This is an example of how the branded email footer will appear in outbound emails when branding is not disabled:

## HTML Email Footer
```html
<div style="text-align: center; margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
  <p style="color: #9ca3af; font-size: 12px; margin: 0;">
    This email is a service from Product Name. Delivered by 
    <a href="https://app.userbird.co/?ref=email&domain=Product%20Name" style="color: #9ca3af; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;" target="_blank" rel="noopener noreferrer">
      <svg width="16" height="16" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: inline-block; vertical-align: middle;">
        <path d="M14.5459 6.36328H14.555" stroke="currentColor" stroke-width="1.81818" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M3.09109 16.3642H10.9093C12.8381 16.3642 14.688 15.598 16.0519 14.2341C17.4158 12.8702 18.182 11.0204 18.182 9.0915V6.36423C18.184 5.5896 17.9387 4.83456 17.4816 4.20913C17.0246 3.5837 16.3798 3.12056 15.6411 2.8872C14.9025 2.65383 14.1086 2.66244 13.3752 2.91177C12.6418 3.1611 12.0072 3.63812 11.5638 4.27332L1.81836 18.1824" stroke="currentColor" stroke-width="1.81818" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M18.1816 6.36328L19.9998 6.81783L18.1816 7.27237" stroke="currentColor" stroke-width="1.81818" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M9.0918 16.3638V19.091" stroke="currentColor" stroke-width="1.81818" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M12.7275 16.1367V19.0913" stroke="currentColor" stroke-width="1.81818" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M6.36426 16.3637C7.48527 16.3637 8.57905 16.0182 9.49674 15.3744C10.4144 14.7305 11.1114 13.8196 11.4929 12.7655C11.8745 11.7114 11.9219 10.5653 11.6289 9.48327C11.3358 8.40123 10.7165 7.43577 9.85517 6.71826" stroke="currentColor" stroke-width="1.81818" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Userbird
    </a>
  </p>
</div>
```

## Plain Text Email Footer
```
---
This email is a service from Product Name. Delivered by Userbird (https://app.userbird.co)
```

## Visual Appearance
The footer will appear at the bottom of the email with a subtle gray color and a small Userbird logo. The "Userbird" text will be a clickable link that leads to the Userbird application.

## When It Appears
This branding footer will only appear:
1. In outbound emails sent by admins and agents from the dashboard
2. When the "Remove branding" toggle in the form settings is turned OFF
3. It will NOT appear in system notification emails (like new feedback notifications)

## Form Settings Dialog
The "Remove branding" option in the form settings dialog now includes updated text to clarify that it affects both the widget and outbound emails:
> Remove "We run on Userbird" branding from the widget and outbound emails 