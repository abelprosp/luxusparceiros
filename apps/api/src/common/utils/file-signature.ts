export interface DetectedFileType {
  mimeType: string;
  extension: string;
}

const PDF: DetectedFileType = { mimeType: 'application/pdf', extension: '.pdf' };
const PNG: DetectedFileType = { mimeType: 'image/png', extension: '.png' };
const JPEG: DetectedFileType = { mimeType: 'image/jpeg', extension: '.jpg' };
const WEBP: DetectedFileType = { mimeType: 'image/webp', extension: '.webp' };

export const DOCUMENT_FILE_TYPES = [PDF, PNG, JPEG];
export const AVATAR_FILE_TYPES = [PNG, JPEG, WEBP];

/** Identifica o tipo real do arquivo pelos primeiros bytes, ignorando nome e MIME enviados pelo cliente. */
export function detectFileType(buffer: Buffer | undefined | null): DetectedFileType | null {
  if (!buffer || buffer.length < 3) return null;
  if (buffer.subarray(0, 5).toString('latin1') === '%PDF-') return PDF;
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return PNG;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return JPEG;
  if (
    buffer.length >= 12
    && buffer.subarray(0, 4).toString('latin1') === 'RIFF'
    && buffer.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return WEBP;
  }
  return null;
}

export function detectAllowedFileType(
  buffer: Buffer | undefined | null,
  allowed: DetectedFileType[],
): DetectedFileType | null {
  const detected = detectFileType(buffer);
  if (!detected) return null;
  return allowed.some((type) => type.mimeType === detected.mimeType) ? detected : null;
}

const INLINE_SAFE_MIME_TYPES = new Set([PDF.mimeType, PNG.mimeType, JPEG.mimeType, WEBP.mimeType]);

/** Arquivos fora da allowlist (ex.: HTML/SVG antigos) são sempre baixados como binário, nunca renderizados. */
export function safeDownloadHeaders(mimeType: string | null | undefined, requestedInline: boolean) {
  const normalized = (mimeType ?? '').toLowerCase().split(';')[0].trim();
  const inlineAllowed = INLINE_SAFE_MIME_TYPES.has(normalized);
  return {
    contentType: inlineAllowed ? normalized : 'application/octet-stream',
    disposition: requestedInline && inlineAllowed ? 'inline' : 'attachment',
  };
}
