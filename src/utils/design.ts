export const SIZES = [
  'Free Size', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', '7XL',
  '28', '30', '32', '34', '36', '38', '40', '42', '44', '46', '48', 'Custom'
];

export const COLOUR_PILLS = [
  { name: 'Red', css: '#ef4444' },
  { name: 'Blue', css: '#3b82f6' },
  { name: 'Black', css: '#1e293b' },
  { name: 'White', css: '#e2e8f0' },
  { name: 'Green', css: '#16a34a' },
  { name: 'Yellow', css: '#eab308' },
  { name: 'Pink', css: '#ec4899' },
  { name: 'Navy', css: '#1e3a5f' },
  { name: 'Grey', css: '#94a3b8' },
  { name: 'Brown', css: '#92400e' },
  { name: 'Orange', css: '#f97316' },
  { name: 'Purple', css: '#9333ea' },
  { name: 'Maroon', css: '#7f1d1d' },
  { name: 'Cream', css: '#fef9c3' },
];

export const COLOUR_MAP: Record<string, string> = {
  red: '#ef4444',
  blue: '#3b82f6',
  black: '#1e293b',
  white: '#e2e8f0',
  green: '#16a34a',
  yellow: '#eab308',
  pink: '#ec4899',
  navy: '#1e3a5f',
  grey: '#94a3b8',
  gray: '#94a3b8',
  brown: '#92400e',
  orange: '#f97316',
  purple: '#9333ea',
  maroon: '#7f1d1d',
  cream: '#fef9c3',
};

export function colourToCSS(name: string): string {
  const lowercaseName = name?.toLowerCase();
  // Try mapping via COLOUR_MAP first
  if (lowercaseName && COLOUR_MAP[lowercaseName]) {
    return COLOUR_MAP[lowercaseName];
  }
  // Try finding in COLOUR_PILLS
  const found = COLOUR_PILLS.find(c => c.name.toLowerCase() === lowercaseName);
  return found ? found.css : '#94a3b8';
}

export function autoGenerateBatch(): string {
  const d = new Date();
  const yyyymmdd = d.getFullYear().toString() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 900) + 100);
  return `B-${yyyymmdd}-${rand}`;
}
