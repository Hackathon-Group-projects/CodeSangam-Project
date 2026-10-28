import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// TS ka ...inputs JavaScript ke kai arguments lene jaisa hai; yeh unke style naam saaf karke jodta hai.
export function cn(...inputs: ClassValue[]) {
  // clsx khaali ya shart wale style sambhalta hai aur twMerge takraate style ko hata deta hai.
  return twMerge(clsx(inputs));
}
