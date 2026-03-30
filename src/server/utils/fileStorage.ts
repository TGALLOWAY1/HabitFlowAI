/**
 * File Storage Utility
 *
 * Handles file uploads and storage for goal badge images.
 * Currently uses local file storage, but can be extended to support S3 or other cloud providers.
 *
 * Note: Routine images are stored in MongoDB and served via API endpoints.
 * This utility is only used for goal badge images.
 */

import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');
const UPLOADS_URL_PREFIX = '/uploads';

const BADGE_MAX_DIMENSION = 800;
const BADGE_QUALITY = 85;

/**
 * Ensure the uploads directory exists.
 */
export function ensureUploadsDir(): void {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

/**
 * Process an image buffer with Sharp: resize to fit within max dimensions,
 * convert to WebP for optimal file size, and strip metadata.
 */
async function processImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(BADGE_MAX_DIMENSION, BADGE_MAX_DIMENSION, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: BADGE_QUALITY })
    .rotate() // auto-rotate based on EXIF
    .toBuffer();
}

/**
 * Save an uploaded file, process it with Sharp, and return its public URL.
 *
 * @param file - The uploaded file (from multer)
 * @param subdirectory - Optional subdirectory within uploads (e.g., 'badges')
 * @returns Public URL path to the saved file
 */
export async function saveUploadedFile(
  file: Express.Multer.File,
  subdirectory: string = 'badges'
): Promise<string> {
  ensureUploadsDir();

  // Create subdirectory if it doesn't exist
  const targetDir = path.join(UPLOADS_DIR, subdirectory);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Process image through Sharp pipeline
  const processedBuffer = await processImage(file.buffer);

  // Always save as .webp after processing
  const uniqueFilename = `${randomUUID()}.webp`;
  const filePath = path.join(targetDir, uniqueFilename);

  fs.writeFileSync(filePath, processedBuffer);

  return `${UPLOADS_URL_PREFIX}/${subdirectory}/${uniqueFilename}`;
}

/**
 * Delete a file by its URL path.
 * 
 * @param urlPath - The public URL path (e.g., '/uploads/badges/uuid.jpg')
 */
export function deleteFileByUrl(urlPath: string): void {
  try {
    // Remove leading slash and convert to file system path
    const relativePath = urlPath.startsWith('/') ? urlPath.slice(1) : urlPath;
    const filePath = path.join(process.cwd(), 'public', relativePath);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error('Error deleting file:', error);
    // Don't throw - file deletion is not critical
  }
}
