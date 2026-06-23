import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getUserInitials(name?: string | null, email?: string | null): string {
  if (name) {
    return name
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  
  if (email) {
    const emailPrefix = email.split("@")[0];
    return emailPrefix.slice(0, 2).toUpperCase();
  }
  
  return "U";
}

export function getUserDisplayName(name?: string | null, email?: string | null): string {
  if (name) {
    return name;
  }
  
  if (email) {
    return email.split("@")[0];
  }
  
  return "User";
}
