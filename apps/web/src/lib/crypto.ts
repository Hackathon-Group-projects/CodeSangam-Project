/**
 * Web Crypto SHA-256 Helper (Client-Side Cryptography)
 * File ko server bhejne se pehle browser ke native crypto engine se uska hash calculate karta hai.
 */

// TS CONCEPT (file: File): Promise<string> -> Normal JS me: async function computeFileSHA256(file) jo aakhri me string return karega
export async function computeFileSHA256(file: File): Promise<string> {
  // 1. Browser me file ko raw binary data (ArrayBuffer) me convert karte hain
  const arrayBuffer = await file.arrayBuffer();

  // 2. Web Crypto API ke zariye SHA-256 algorithm se binary hash calculate hota hai
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  
  // 3. Binary bytes ko 64-character ke hexadecimal string me convert karte hain
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex; // 64-character SHA-256 hash return hota hai
}

/**
 * Anonymous Mode ke liye 32-byte (64 hex characters) secure random secret key banata hai.
 * Ye key sirf anonymous petitioner ke paas rehti hai taaki identity hide rahe.
 */
// TS CONCEPT (: string) -> function ek plain text (string) return karega
export function generateClientReceiptSecret(): string {
  // 1. 32-byte ka random byte array allocate karte hain
  const randomBytes = new Uint8Array(32);

  // 2. Browser ka cryptographically secure random number generator use karte hain
  crypto.getRandomValues(randomBytes);

  // 3. Bytes ko hex string me badal kar return karte hain (64 characters)
  return Array.from(randomBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}
