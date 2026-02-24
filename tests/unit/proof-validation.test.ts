import type { Message } from "grammy/types";
import { describe, expect, it } from "vitest";

import {
  canAcceptProof,
  validateProofMedia,
} from "../../src/services/proof-validation.js";

function asMessage(value: object): Message {
  return value as unknown as Message;
}

describe("proof validation", () => {
  it("accepts photo proofs", () => {
    const result = validateProofMedia(
      asMessage({
        message_id: 1,
        date: 1,
        chat: { id: 1, type: "private" },
        photo: [
          {
            file_id: "f1",
            file_unique_id: "u1",
            width: 1,
            height: 1,
            file_size: 1024,
          },
        ],
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fileId).toBe("f1");
    }
  });

  it("rejects non-image documents", () => {
    const result = validateProofMedia(
      asMessage({
        message_id: 1,
        date: 1,
        chat: { id: 1, type: "private" },
        document: {
          file_id: "f1",
          file_unique_id: "u1",
          file_name: "proof.pdf",
          mime_type: "application/pdf",
          file_size: 1024,
        },
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("invalid_type");
    }
  });

  it("enforces order state gate for proof uploads", () => {
    expect(canAcceptProof("awaiting_proof")).toBe(true);
    expect(canAcceptProof("draft")).toBe(false);
    expect(canAcceptProof("awaiting_admin_review")).toBe(false);
  });
});
