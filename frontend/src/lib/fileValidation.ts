import type { UploadRejectionReason } from '../types/sourceDocument'

export type FileValidationResult =
  | { valid: true }
  | { valid: false; reason: UploadRejectionReason }

export function validateFile(
  file: File,
  maxSizeBytes: number,
  acceptedTypes: string[],
): FileValidationResult {
  const nameLower = file.name.toLowerCase()
  const hasAcceptedExtension = acceptedTypes.some(
    (type) => type.startsWith('.') && nameLower.endsWith(type),
  )
  const hasAcceptedMimeType = acceptedTypes.includes(file.type)
  const isAcceptedType = hasAcceptedExtension || hasAcceptedMimeType

  if (!isAcceptedType) {
    return { valid: false, reason: 'invalid-type' }
  }

  if (file.size > maxSizeBytes) {
    return { valid: false, reason: 'too-large' }
  }

  return { valid: true }
}
