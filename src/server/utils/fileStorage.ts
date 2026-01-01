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

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');
const UPLOADS_URL_PREFIX = '/uploads';

/**
 * Ensure the uploads directory exists.
 */
export function ensureUploadsDir(): void {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

/**
 * Save an uploaded file and return its public URL.
 * 
 * @param file - The uploaded file (from multer)
 * @param subdirectory - Optional subdirectory within uploads (e.g., 'badges')
 * @returns Public URL path to the saved file
 */
export function saveUploadedFile(
  file: Express.Multer.File,
  subdirectory: string = 'badges'
): string {
  ensureUploadsDir();

  // Create subdirectory if it doesn't exist
  const targetDir = path.join(UPLOADS_DIR, subdirectory);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Generate unique filename
  const fileExtension = path.extname(file.originalname);
  const uniqueFilename = `${randomUUID()}${fileExtension}`;
  const filePath = path.join(targetDir, uniqueFilename);

  // Save file
  fs.writeFileSync(filePath, file.buffer);

  // Return public URL path
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
