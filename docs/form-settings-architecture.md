# Form Settings Architecture Pattern

## Overview

This document outlines the standardized pattern used for handling form settings in the Userbird application. The pattern ensures consistency across different settings tabs and provides a clean, reliable approach to managing form data.

## Core Architecture

The architecture follows a parent-child pattern with controlled components:

1. **Parent Component (`FormSettingsDialog`)**: 
   - Manages all state for form settings
   - Handles data fetching and persistence
   - Maintains "original" values for comparison
   - Provides handlers to child components

2. **Child Components (Settings Tabs)**:
   - Receive state and handlers from parent
   - Delegate state management to parent
   - Focus on UI rendering and user interaction

## State Management Flow

```
┌─────────────────────────────────────┐
│ FormSettingsDialog                  │
│                                     │
│ ┌─────────────┐    ┌──────────────┐ │
│ │ State       │    │ API Calls    │ │
│ │ - formState │    │ - fetch()    │ │
│ │ - original  │◄───┤ - update()   │ │
│ └─────┬───────┘    └──────┬───────┘ │
│       │                   │         │
│       ▼                   ▲         │
│ ┌─────────────┐    ┌──────────────┐ │
│ │ Handlers    │    │ Event        │ │
│ │ - onChange  │    │ Triggers     │ │
│ │ - onBlur    │────┤ - blur       │ │
│ └─────┬───────┘    └──────────────┘ │
└───────┼─────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────┐
│ Child Component (Tab)               │
│                                     │
│ ┌─────────────┐    ┌──────────────┐ │
│ │ Props       │    │ UI Elements  │ │
│ │ - value     │───►│ - inputs     │ │
│ │ - onChange  │◄───┤ - controls   │ │
│ │ - onBlur    │    │              │ │
│ └─────────────┘    └──────────────┘ │
└─────────────────────────────────────┘
```

## Implementation Details

### Parent Component

1. **State Declaration**:
   ```typescript
   // Primary state
   const [fieldValue, setFieldValue] = useState(initialValue);
   
   // Original value for comparison
   const [originalValue, setOriginalValue] = useState(initialValue);
   ```

2. **Data Fetching**:
   ```typescript
   const fetchData = async () => {
     try {
       const { data, error } = await supabase
         .from('table_name')
         .select('field_name')
         .eq('id', entityId)
         .single();
       
       if (error) {
         console.error('Error fetching data:', error);
         return;
       }
       
       // Update both current and original values
       setFieldValue(data.field_name);
       setOriginalValue(data.field_name);
     } catch (error) {
       console.error('Exception when fetching data:', error);
     }
   };
   ```

3. **Value Change Handler**:
   ```typescript
   const handleValueChange = (value: string) => {
     setFieldValue(value);
   };
   ```

4. **Blur Handler (Save)**:
   ```typescript
   const handleValueBlur = async () => {
     // Skip if unchanged
     if (fieldValue === originalValue) {
       return;
     }

     try {
       const { error } = await supabase
         .from('table_name')
         .update({ field_name: fieldValue })
         .eq('id', entityId);

       if (error) throw error;

       // Update original value after successful save
       setOriginalValue(fieldValue);
       toast.success('Field updated successfully');
     } catch (error) {
       console.error('Error updating field:', error);
       
       // Revert to original on error
       setFieldValue(originalValue);
       toast.error('Failed to update field');
     }
   };
   ```

5. **Component Rendering**:
   ```tsx
   <TabComponent
     value={fieldValue}
     onValueChange={handleValueChange}
     onValueBlur={handleValueBlur}
   />
   ```

### Child Component

1. **Props Interface**:
   ```typescript
   interface TabComponentProps {
     value: string;
     onValueChange?: (value: string) => void;
     onValueBlur?: () => void;
   }
   ```

2. **Controlled Component Implementation**:
   ```tsx
   function TabComponent({
     value,
     onValueChange,
     onValueBlur
   }: TabComponentProps) {
     // Local state fallback if parent doesn't control
     const [localValue, setLocalValue] = useState(value || '');
     
     // Update local value when prop changes
     useEffect(() => {
       if (value !== undefined) {
         setLocalValue(value);
       }
     }, [value]);
     
     // Handle change based on parent control
     const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
       const newValue = e.target.value;
       
       if (onValueChange) {
         // Parent controls state
         onValueChange(newValue);
       } else {
         // Local state
         setLocalValue(newValue);
       }
     };
     
     // Handle blur based on parent control
     const handleBlur = () => {
       if (onValueBlur) {
         // Parent handles saving
         onValueBlur();
       } else {
         // Local saving logic if needed
         saveLocalValue();
       }
     };
     
     return (
       <Input
         value={onValueChange ? value : localValue}
         onChange={handleChange}
         onBlur={handleBlur}
       />
     );
   }
   ```

## Benefits of This Pattern

1. **Consistency**: All form settings follow the same pattern, making the codebase more maintainable.

2. **Separation of Concerns**:
   - Parent manages data and persistence
   - Child components focus on UI and user interaction

3. **Immediate Feedback**: Changes are saved on blur, providing immediate feedback to users.

4. **Error Handling**: Failed saves revert to the original state, preventing data inconsistency.

5. **Performance**: No unnecessary re-renders or API calls for unchanged values.

6. **No Data Flashing**: Since state is managed at the parent level, there's no flashing of old data when reopening dialogs.

## When to Use This Pattern

This pattern is ideal for:

- Form settings that need to be saved individually
- Settings with immediate apply behavior
- Any form where you want to avoid "Save" buttons and prefer auto-save on blur
- Components that need to maintain original values for comparison

## Implementation Checklist

When implementing a new settings field:

1. ✅ Add state variables in the parent component
2. ✅ Add an "original" state to track unchanged values
3. ✅ Implement fetch function that sets both state variables
4. ✅ Create onChange handler that updates state
5. ✅ Create onBlur handler that saves to backend if changed
6. ✅ Update child component to accept and use parent handlers
7. ✅ Add fallback local state in the child component if needed

Following this pattern consistently will ensure a smooth user experience with no flashing data issues. 