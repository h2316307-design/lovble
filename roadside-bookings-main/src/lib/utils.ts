import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatGregorianDate(input: string | Date, locale: string = 'ar-LY'): string {
  try {
    const date = input instanceof Date ? input : new Date(input);
    const options: Intl.DateTimeFormatOptions & { calendar?: string } = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      calendar: 'gregory'
    };
    return new Intl.DateTimeFormat(locale, options).format(date);
  } catch {
    return '';
  }
}
