import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merges Tailwind classes safely, resolving conflicts */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
