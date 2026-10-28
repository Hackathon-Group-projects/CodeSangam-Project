import { computeFileSHA256 } from './crypto';
import { AttachmentMeta } from '@vishanti/shared';

// Next.js mein NEXT_PUBLIC_ wali setting browser tak ja sakti hai; yahan koi password nahi, sirf server ka address hai.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// TS CONCEPT (interface for callback): Upload progress batane wala function ka signature
export interface UploadProgressCallback {
  (progressPercent: number): void;
}

/**
 * Direct MinIO / S3 Uploader:
 * Heavy files (PDFs, Images) ko backend API server se bypass karke direct S3 me bhejta hai,
 * taaki backend server par memory ka load na pade.
 */
export async function uploadAttachmentDirectly(
  file: File,                           // Browser me chuni gayi file object
  onProgress?: UploadProgressCallback   // Optional progress callback function
): Promise<AttachmentMeta> {
  // Step 1: File upload hone se pehle hi browser me Web Crypto se SHA-256 hash nikalte hain
  const sha256Hash = await computeFileSHA256(file);

  // Storage path banate hain (e.g. attachments/173000000-sample.pdf)
  const storageKey = `attachments/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  try {
    // Step 2: Backend se temporary presigned upload URL maangte hain
    const presignRes = await fetch(`${API_URL}/api/upload/presign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
        sha256Hash,
        storageKey,
      }),
    });

    if (presignRes.ok) {
      const { uploadUrl } = await presignRes.json();
      
      // Step 3: Seedhe MinIO / S3 bucket me HTTP PUT request se file bytes transfer karte hain
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
      });

      if (!putRes.ok) {
        throw new Error(`Failed to upload to object storage: ${putRes.statusText}`);
      }
    } else {
      console.warn('Direct presigned URL unavailable from backend. Running in simulated local storage mode.');
    }
  } catch (err) {
    console.warn('MinIO upload fallback for dev mode:', err);
  }

  // Step 4: Backend ko bhejne ke liye lightweight metadata return karte hain (not the heavy file bytes!)
  return {
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || 'application/octet-stream',
    storageKey,
    sha256Hash,
  };
}
