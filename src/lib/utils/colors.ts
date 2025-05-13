// Color options for consistent tag colors across components
export const colorOptions = [
  { 
    name: 'Gray', 
    value: '#64748B',
    background: '#64748B25',
    text: '#334155',
    dark: {
      value: '#A1B2CB',
      background: '#64748B38',
      text: '#A1B2CB'
    }
  },
  { 
    name: 'Brown', 
    value: '#78716C',
    background: '#78716C25',
    text: '#44403C',
    dark: {
      value: '#AE9276',
      background: '#78716C38',
      text: '#AE9276'
    }
  },
  { 
    name: 'Orange', 
    value: '#F97316',
    background: '#F9731625',
    text: '#C2410C',
    dark: {
      value: '#FF7036',
      background: '#F9731638',
      text: '#FF7036'
    }
  },
  { 
    name: 'Yellow', 
    value: '#EAB308',
    background: '#EAB30825',
    text: '#854D0E',
    dark: {
      value: '#F3C431',
      background: '#EAB30838',
      text: '#F3C431'
    }
  },
  { 
    name: 'Green', 
    value: '#10B981',
    background: '#10B98125',
    text: '#047857',
    dark: {
      value: '#13DBA2',
      background: '#10B98138',
      text: '#13DBA2'
    }
  },
  { 
    name: 'Blue', 
    value: '#3B82F6',
    background: '#3B82F625',
    text: '#1D4ED8',
    dark: {
      value: '#81A2FF',
      background: '#488EFF38',
      text: '#81A2FF'
    }
  },
  { 
    name: 'Purple', 
    value: '#8B5CF6',
    background: '#8B5CF625',
    text: '#6D28D9',
    dark: {
      value: '#C09DF7',
      background: '#8B5CF638',
      text: '#C09DF7'
    }
  },
  { 
    name: 'Pink', 
    value: '#EC4899',
    background: '#EC489925',
    text: '#BE185D',
    dark: {
      value: '#FF62A3',
      background: '#EC489938',
      text: '#FF62A3'
    }
  },
  { 
    name: 'Red', 
    value: '#EF4444',
    background: '#EF444425',
    text: '#B91C1C',
    dark: {
      value: '#F25C5C',
      background: '#EF444438',
      text: '#F25C5C'
    }
  }
];

/**
 * Get background and text colors for a tag based on its color
 */
export function getTagColors(tagColor: string, isDarkMode = false) {
  const colorOption = colorOptions.find(option => 
    isDarkMode 
      ? option.dark.value === tagColor 
      : option.value === tagColor
  );

  if (colorOption) {
    if (isDarkMode) {
      return {
        background: colorOption.dark.background,
        text: colorOption.dark.text
      };
    }
    return {
      background: colorOption.background,
      text: colorOption.text
    };
  }

  // Fallback for custom colors
  return {
    background: `${tagColor}25`,
    text: tagColor
  };
} 