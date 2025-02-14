import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isValidUrl(url: string) {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

export function isValidHexColor(color: string) {
  return /^#[0-9a-fA-F]{6}$/.test(color)
}

export function areArraysEqual<T>(a: T[], b: T[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  
  // For arrays of objects, we need to stringify for comparison
  if (typeof a[0] === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  
  // For primitive arrays, we can use simple comparison
  return a.every((item, index) => item === b[index]);
}