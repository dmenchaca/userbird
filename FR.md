# Userbird Functional Requirements Document

## MVP Requirements

### Form Creation
1. Landing page must:
   - Show a prominent "New form" button
   - No user authentication/login required
   - No user accounts needed
2. Form creation flow must have:
   - Single input field for website's global URL (e.g., "app.userbird.co")
   - URL format validation
   - Generate a unique form identifier
3. After URL submission:
   - Show installation instructions
   - Provide both trigger code and instructions code separately
   - No styling options for MVP

### Flexible Button Integration
1. The feedback trigger component must:
   - Be flexible enough to be placed anywhere in the client's UI
   - Support placement in navigation bars
   - Support placement in dropdown menus
   - Support placement in any container element
2. Installation code must:
   - Be provided in two parts: trigger and instructions
   - Allow developers to place the trigger code in their desired location
   - Include clear examples of different placement options
   - Be simple enough to integrate into existing UI components

### Feedback Form & Data
1. The feedback form must:
   - Appear when trigger is clicked
   - Position itself as a floating popover directly below the trigger button
   - Maintain proper spacing from the trigger button (approximately 8-12px gap)
   - Adjust its position if there isn't enough space below (should appear above the trigger in such cases)
   - Contain a text field for feedback
   - Include a submit button
   - No styling customization for MVP
2. Data collection must:
   - Store submitted feedback message
   - Record submission timestamp
3. Data display must:
   - Show submissions in a basic table format
   - Display data chronologically
   - No search/filter capabilities for MVP
   - No export functionality for MVP

## Post-MVP Requirements

### Form Styling
1. Form styling interface must:
   - Show live preview of the form on one side
   - Show customization controls on the other side
2. Customizable elements must include:
   - Primary button colors
   - Secondary button colors
3. Font handling must:
   - Automatically detect and inherit client website's paragraph font family
   - Automatically detect and inherit font size
   - Fall back to system font if website font detection fails
4. Style preview must:
   - Update in real-time as changes are made
   - Show actual form layout and appearance
   - Display both default and hover states for buttons

### Authentication & First-Time Experience
1. User authentication must support:
   - Google SSO integration
   - Email/password registration
2. Email verification flow must:
   - Generate 6-digit OTP
   - Send verification email
   - Verify OTP before dashboard access
3. First-time user experience must:
   - Show empty state screen after verification
   - Display prominent CTA to create new form

### Navigation & Form Management
1. Left navigation bar must include:
   - "New form" CTA button at top
   - List of active forms below
   - Visual indication of currently selected form
2. Form list must:
   - Show all user's active forms
   - Allow clicking to view form responses
   - Update in real-time when new forms are created
3. Form selection must:
   - Load associated feedback table
   - Update URL for bookmarking
   - Show form-specific settings

### Advanced Data Collection
1. Automated data collection must capture:
   - User ID
   - User email
   - User name
   - Message
   - Timestamp
   - Browser details
   - Operating system
   - Screen size category (Desktop/Mobile/Tablet)
2. Additional location data must include:
   - Country
   - City
3. All data must be:
   - Collected automatically
   - Stored securely
   - Associated with correct form

### Table Capabilities
1. Enhanced table features must include:
   - Search functionality across all fields
   - Column sorting (ascending/descending)
   - Column show/hide toggles
   - Custom filters per column type
2. Table interface must:
   - Save user preferences
   - Support pagination
   - Allow bulk actions
   - Enable data export

### Image Attachment
1. Image upload must support:
   - Multiple images per submission
   - File upload from computer
   - Screenshot capture functionality
2. Image preview features must:
   - Show thumbnails of uploaded images
   - Allow image deletion before submission
   - Support full-size preview
3. Screenshot tool must:
   - Capture current viewport
   - Allow area selection
   - Include basic annotation tools

### Email Notifications
1. Email notification system must:
   - Send immediate notifications for new feedback
   - Include all collected user data
   - Support multiple recipient configuration
2. Email settings must allow:
   - Add/remove notification recipients
   - Configure notification frequency
   - Customize email template
3. Notification emails must include:
   - User ID
   - User email
   - User name
   - Feedback message
   - Submission timestamp
   - Direct link to feedback entry