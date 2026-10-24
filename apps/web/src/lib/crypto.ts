/**
 * Web Crypto SHA-256 Helper
 * Computes deterministic SHA-256 hash inside the browser using Web Crypto API.
 * Ensures the cryptographic checksum is produced before uploading bytes to storage.
 */

export async function computeFileSHA256(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  
  // Convert ArrayBuffer to 64-character hexadecimal string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex;
}

/**
 * Generates high-entropy 32-byte (64 hex characters) cryptographic receipt secret
 * Used for anonymous ticket tracking and non-repudiation disputes.
 */
export function generateClientReceiptSecret(): string {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  return Array.from(randomBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}
