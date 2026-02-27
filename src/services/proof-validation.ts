import { ALLOWED_PROOF_MIME } from "../config/constants.js";
import { env } from "../config/env.js";

export type ProofValidationResult =
  | {
      ok: true;
      fileId: string;
      mimeType: string;
      sizeBytes: number | null;
    }
  | {
      ok: false;
      reason: "missing_proof" | "invalid_type" | "too_large";
    };

type MessageLike = {
  photo?: Array<{
    file_id: string;
    file_size?: number;
  }>;
  document?: {
    file_id: string;
    mime_type?: string;
    file_size?: number;
  };
};

export function validateProofMedia(
  message: MessageLike,
): ProofValidationResult {
  const maxBytes = env.MAX_PROOF_SIZE_MB * 1024 * 1024;

  if (message.photo && message.photo.length > 0) {
    const largest = message.photo[message.photo.length - 1];
    if (!largest) {
      return { ok: false, reason: "missing_proof" };
    }

    const sizeBytes = largest.file_size ?? null;
    if (sizeBytes !== null && sizeBytes > maxBytes) {
      return { ok: false, reason: "too_large" };
    }

    return {
      ok: true,
      fileId: largest.file_id,
      mimeType: "image/jpeg",
      sizeBytes,
    };
  }

  if (message.document) {
    const mime = message.document.mime_type ?? "";
    if (
      !ALLOWED_PROOF_MIME.includes(mime as (typeof ALLOWED_PROOF_MIME)[number])
    ) {
      return { ok: false, reason: "invalid_type" };
    }

    const sizeBytes = message.document.file_size ?? null;
    if (sizeBytes !== null && sizeBytes > maxBytes) {
      return { ok: false, reason: "too_large" };
    }

    return {
      ok: true,
      fileId: message.document.file_id,
      mimeType: mime,
      sizeBytes,
    };
  }

  return { ok: false, reason: "missing_proof" };
}

export function canAcceptProof(orderStatus: string): boolean {
  return orderStatus === "awaiting_proof";
}
