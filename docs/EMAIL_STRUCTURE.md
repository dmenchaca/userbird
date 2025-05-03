# Email Structure Guidelines

## Gmail Compatibility Requirements

When working with email templates in Userbird, especially for reply emails, it's crucial to maintain a specific structure to ensure Gmail's expand/collapse functionality works properly.

### Required Email Structure

```
┌─────────────────────────┐
│ Main Reply Content      │
├─────────────────────────┤
│ Branding/Footer         │
├─────────────────────────┤
│ Timestamp Line          │ ◄── Must be directly adjacent to quoted content
├─────────────────────────┤
│ Quoted Content          │
└─────────────────────────┘
```

### Important Rules

1. **Timestamp and Quoted Content Adjacency**: 
   - The timestamp line (e.g., "On Apr 30, 2025, user@email.com wrote:") MUST be directly adjacent to the quoted content.
   - No HTML elements or content should interrupt this adjacency.

2. **Branding Position**:
   - Always place branding/footer elements BEFORE the timestamp line.
   - Never place branding between the timestamp and quoted content.

3. **Structure Consistency**:
   - Maintain this structure for both HTML and plain text versions of emails.
   - In HTML, keep the same structural order of elements.

4. **Gmail Expand/Collapse Functionality**:
   - Gmail uses the direct adjacency of timestamp lines to quoted content as a signal to add expand/collapse buttons.
   - Breaking this pattern will cause Gmail to not add these controls, resulting in a poorer user experience.

### Example HTML Structure

```html
<div class="email-main-content">
  User's reply content here
</div>
<div class="email-branding-footer">
  We run on Userbird
</div>
<div class="email-timestamp">
  On Apr 30, 2025, 4:03 PM, user@email.com wrote:
</div>
<div class="email-quoted-content">
  <blockquote>Original message here</blockquote>
</div>
```

### Example Plain Text Structure

```
User's reply content here

We run on Userbird (https://app.userbird.co)

On Apr 30, 2025, 4:03 PM, user@email.com wrote:
> Original message here
```

## Email Client Compatibility

This structure has been tested with:

- Gmail (Web and Mobile)
- Apple Mail
- Outlook
- Other major email clients

Always test any changes to email structure with multiple email clients before deploying to production.

## Troubleshooting

If Gmail's expand/collapse functionality isn't working:

1. Check that no elements are positioned between the timestamp line and quoted content
2. Verify the timestamp line format is recognized by Gmail
3. Ensure the quoted content uses appropriate HTML tags (typically `<blockquote>`)

For more detailed implementation, see the code in `netlify/functions/email-service.ts`. 