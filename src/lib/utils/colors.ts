// Color options for consistent tag colors across components
export const colorOptions = [
  { 
    name: 'Gray', 
    value: '#64748B',
    background: '#64748B25',
    text: '#334155'
  },
  { 
    name: 'Brown', 
    value: '#78716C',
    background: '#78716C25',
    text: '#44403C'
  },
  { 
    name: 'Orange', 
    value: '#F97316',
    background: '#F9731625',
    text: '#C2410C'
  },
  { 
    name: 'Yellow', 
    value: '#EAB308',
    background: '#EAB30825',
    text: '#854D0E'
  },
  { 
    name: 'Green', 
    value: '#10B981',
    background: '#10B98125',
    text: '#047857'
  },
  { 
    name: 'Blue', 
    value: '#3B82F6',
    background: '#3B82F625',
    text: '#1D4ED8'
  },
  { 
    name: 'Purple', 
    value: '#8B5CF6',
    background: '#8B5CF625',
    text: '#6D28D9'
  },
  { 
    name: 'Pink', 
    value: '#EC4899',
    background: '#EC489925',
    text: '#BE185D'
  },
  { 
    name: 'Red', 
    value: '#EF4444',
    background: '#EF444425',
    text: '#B91C1C'
  }
];

/**
 * Get background and text colors for a tag based on its color
 */
export function getTagColors(tagColor: string) {
  const colorOption = colorOptions.find(option => option.value === tagColor);
  return colorOption ? {
    background: colorOption.background,
    text: colorOption.text
  } : {
    background: `${tagColor}25`,
    text: tagColor
  };
} 