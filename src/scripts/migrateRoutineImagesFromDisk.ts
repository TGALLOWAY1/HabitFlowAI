/**
 * Migration Script: Routine Images from Filesystem to MongoDB
 * 
 * ⚠️ LOCAL-ONLY SCRIPT ⚠️
 * 
 * This script migrates routine images from the filesystem (`public/uploads/routine-images/`)
 * to MongoDB storage. It is intended for local development/testing only.
 * 
 * Prerequisites:
 * - Old routine images must exist in `public/uploads/routine-images/`
 * - Routines in MongoDB must have `imageUrl` fields pointing to `/uploads/routine-images/...` paths
 * - MongoDB connection must be configured via environment variables
 * 
 * Usage:
 *   npx tsx src/scripts/migrateRoutineImagesFromDisk.ts
 * 
 * What it does:
 * 1. Scans all routines in MongoDB
 * 2. Finds routines with old filesystem image URLs (`/uploads/routine-images/...`)
 * 3. Reads image files from filesystem
 * 4. Uploads images to MongoDB via routineImagesRepo
 * 5. Updates routine documents with new `imageId` reference
 * 6. Optionally deletes old filesystem files (commented out by default)
 * 
 * Safety:
 * - Does not delete old files by default (uncomment deletion code if desired)
 * - Skips routines that already have MongoDB images
 * - Logs all operations for verification
 */

import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { Binary } from 'mongodb';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'HabitFlowAI';

if (!MONGODB_URI) {
  console.error('Error: MONGODB_URI environment variable is required');
  process.exit(1);
}

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads', 'routine-images');

/**
 * Extract filename from old image URL path.
 * Example: "/uploads/routine-images/uuid.jpg" -> "uuid.jpg"
 */
function extractFilenameFromUrl(imageUrl: string): string | null {
  if (!imageUrl || !imageUrl.startsWith('/uploads/routine-images/')) {
    return null;
  }
  return imageUrl.replace('/uploads/routine-images/', '');
}

/**
 * Determine content type from file extension.
 */
function getContentTypeFromFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
  };
  return mimeTypes[ext] || 'image/jpeg'; // Default to JPEG
}

async function migrate() {
  console.log('Starting migration: Routine Images from Filesystem to MongoDB');
  console.log(`MongoDB URI: ${MONGODB_URI?.replace(/\/\/.*@/, '//***@')}`);
  console.log(`Database: ${MONGODB_DB_NAME}`);
  console.log(`Uploads directory: ${UPLOADS_DIR}`);
  console.log('');

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    const db = client.db(MONGODB_DB_NAME);

    const routinesCollection = db.collection('routines');
    const routineImagesCollection = db.collection('routineImages');

    // Find all routines
    const routines = await routinesCollection.find({}).toArray();
    console.log(`Found ${routines.length} routine(s) in database`);
    console.log('');

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const routine of routines) {
      const routineId = routine.id;
      const oldImageUrl = routine.imageUrl;

      // Skip if no old image URL
      if (!oldImageUrl || !oldImageUrl.startsWith('/uploads/routine-images/')) {
        skippedCount++;
        continue;
      }

      // Skip if routine already has imageId (already migrated)
      if (routine.imageId) {
        console.log(`⏭️  Skipping routine "${routine.title}" (${routineId}): Already has imageId`);
        skippedCount++;
        continue;
      }

      // Extract filename and build filesystem path
      const filename = extractFilenameFromUrl(oldImageUrl);
      if (!filename) {
        console.log(`⚠️  Skipping routine "${routine.title}" (${routineId}): Invalid image URL format`);
        skippedCount++;
        continue;
      }

      const filePath = path.join(UPLOADS_DIR, filename);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.log(`⚠️  Skipping routine "${routine.title}" (${routineId}): File not found: ${filePath}`);
        skippedCount++;
        continue;
      }

      try {
        // Read file from filesystem
        const fileBuffer = fs.readFileSync(filePath);
        const contentType = getContentTypeFromFilename(filename);

        console.log(`📤 Migrating image for routine "${routine.title}" (${routineId})`);
        console.log(`   File: ${filename} (${(fileBuffer.length / 1024).toFixed(2)} KB, ${contentType})`);

        // Upload to MongoDB
        const now = new Date();
        const binaryData = new Binary(fileBuffer);

        await routineImagesCollection.findOneAndUpdate(
          { routineId },
          {
            $set: {
              routineId,
              contentType,
              data: binaryData,
              updatedAt: now,
            },
            $setOnInsert: {
              createdAt: now,
            },
          },
          { upsert: true }
        );

        // Update routine with imageId reference
        await routinesCollection.updateOne(
          { id: routineId },
          {
            $set: {
              imageId: routineId, // imageId is the same as routineId
              // Note: imageUrl will be set by API on next fetch, but we keep old URL for now
            },
          }
        );

        console.log(`   ✅ Migrated successfully`);
        migratedCount++;

        // Optional: Delete old filesystem file (UNCOMMENT IF DESIRED)
        // fs.unlinkSync(filePath);
        // console.log(`   🗑️  Deleted old file: ${filePath}`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`   ❌ Error migrating image for routine "${routine.title}" (${routineId}): ${errorMessage}`);
        errorCount++;
      }
    }

    console.log('');
    console.log('Migration Complete');
    console.log(`✅ Migrated: ${migratedCount}`);
    console.log(`⏭️  Skipped: ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);

    if (migratedCount > 0) {
      console.log('');
      console.log('⚠️  Note: Old filesystem files were NOT deleted.');
      console.log('   Uncomment the deletion code in the script if you want to remove them.');
    }

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('Disconnected from MongoDB');
  }
}

// Run migration
migrate().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

