export interface ReviewImage {
  readonly id: string;
  readonly name: string;
  readonly mimeType: "image/png" | "image/jpeg" | "image/webp";
  readonly data: Uint8Array;
}

export interface ReviewRequest {
  readonly eventId: string;
  readonly messageText: string;
  readonly images: readonly ReviewImage[];
}
