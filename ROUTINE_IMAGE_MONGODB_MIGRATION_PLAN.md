# Routine Image MongoDB Migration Plan

## Analysis Summary

### Current Implementation

#### 1. Backend Upload Endpoint
- **File**: `src/server/routes/routines.ts`
- **Endpoint**: `POST /api/upload/routine-image` (line 453-482)
- **Middleware**: `uploadRoutineImageMiddleware` (line 39) - multer single file upload
- **Multer Config**: Lines 24-37
  - In-memory storage (`multer.memoryStorage()`)
  - 5MB file size limit
  - Image files only filter
- **Storage**: Calls `saveUploadedFile(req.file, 'routine-images')` (line 466)
- **Response**: Returns `{ url: publicUrl }` where `publicUrl` is `/uploads/routine-images/{uuid}.ext`

#### 2. File Storage Utility
- **File**: `src/server/utils/fileStorage.ts`
- **Function**: `saveUploadedFile()` (lines 31-53)
- **Storage Location**: `public/uploads/routine-images/{uuid}.{ext}`
- **Returns**: Public URL path `/uploads/routine-images/{uuid}.{ext}`

#### 3. Static File Serving
- **File**: `src/server/index.ts`
- **Line**: 41
- **Config**: `app.use('/uploads', express.static('public/uploads'))`
- **Purpose**: Serves uploaded files directly from filesystem

#### 4. Frontend Upload Client
- **File**: `src/lib/persistenceClient.ts`
- **Function**: `uploadRoutineImage(file: File)` (lines 552-579)
- **Endpoint**: `POST /api/upload/routine-image`
- **Returns**: URL string from `data.url`
- **Usage**: Called by `RoutineEditorModal` component

#### 5. Frontend Component Usage
- **File**: `src/components/RoutineEditorModal.tsx`
- **Line**: 39 - Calls `uploadRoutineImage(file)`
- **Line**: 40 - Stores returned URL in `step.imageUrl`
- **Line**: 333 - Input field for manual URL entry
- **Line**: 345 - Image preview using `step.imageUrl`

#### 6. Frontend Display
- **File**: `src/components/RoutineRunnerModal.tsx`
- **Line**: 201 - Displays image: `<img src={currentStep.imageUrl} />`

#### 7. Data Model
- **File**: `src/models/persistenceTypes.ts`
- **Interface**: `RoutineStep` (line 338-365)
- **Field**: `imageUrl?: string` (line 352)
- **Storage**: Stored as string in MongoDB `routines` collection

#### 8. Repository Layer
- **File**: `src/server/repositories/routineRepository.ts`
- **Operations**: `createRoutine()`, `updateRoutine()`, `getRoutine()`, `getRoutines()`
- **Storage**: Routines stored in MongoDB `routines` collection
- **Note**: `imageUrl` is stored as a string field in the RoutineStep object

---

## Current Behavior Summary

### Upload Flow
1. User selects image in `RoutineEditorModal`
2. Frontend calls `uploadRoutineImage(file)` → POST to `/api/upload/routine-image`
3. Backend receives file via multer (in-memory buffer)
4. Backend saves to `public/uploads/routine-images/{uuid}.{ext}`
5. Backend returns `/uploads/routine-images/{uuid}.{ext}`
6. Frontend stores URL in `step.imageUrl`
7. Routine saved to MongoDB with `imageUrl` string field

### Display Flow
1. Routine loaded from MongoDB (includes `step.imageUrl` string)
2. Frontend renders `<img src={step.imageUrl} />`
3. Browser requests `/uploads/routine-images/{uuid}.{ext}`
4. Express static middleware serves file from filesystem

---

## Proposed MongoDB Implementation Plan

### Approach: Store Binary Data in MongoDB Collection

**Decision**: Use a dedicated MongoDB collection (not GridFS) for simplicity:
- Images are small (< 5MB)
- Simpler API than GridFS
- Direct document access
- No need for chunking

### Implementation Steps

#### Phase 1: Create MongoDB Image Storage

**1.1 Create Image Repository**
- **File**: `src/server/repositories/routineImageRepository.ts` (NEW)
- **Functions**:
  - `saveRoutineImage(buffer: Buffer, contentType: string, userId: string): Promise<string>`
    - Generates UUID for image ID
    - Stores: `{ id, userId, data: Binary, contentType, createdAt }`
    - Returns image ID
  - `getRoutineImage(imageId: string, userId: string): Promise<{ data: Buffer, contentType: string } | null>`
    - Retrieves image by ID with userId check
  - `deleteRoutineImage(imageId: string, userId: string): Promise<boolean>`
    - Deletes image document

**1.2 Add Collection Constant**
- **File**: `src/models/persistenceTypes.ts`
- **Location**: `MONGO_COLLECTIONS` object (around line 1038)
- **Add**: `ROUTINE_IMAGES: 'routineImages'`

**1.3 Create Image Type (Optional)**
- **File**: `src/models/persistenceTypes.ts`
- **Add Interface**:
  ```typescript
  export interface RoutineImage {
    id: string;
    userId: string;
    data: Buffer; // MongoDB Binary type
    contentType: string;
    createdAt: string;
  }
  ```

#### Phase 2: Update Upload Endpoint

**2.1 Modify Upload Route**
- **File**: `src/server/routes/routines.ts`
- **Function**: `uploadRoutineImageRoute()` (line 453)
- **Changes**:
  - Remove `saveUploadedFile()` call
  - Call `saveRoutineImage(req.file.buffer, req.file.mimetype, userId)`
  - Return `{ imageId: string }` instead of `{ url: string }`

**2.2 Remove File Storage Dependency**
- **File**: `src/server/routes/routines.ts`
- **Line**: 22 - Remove `import { saveUploadedFile } from '../utils/fileStorage'`

#### Phase 3: Create Image Serving Endpoint

**3.1 Add GET Image Route**
- **File**: `src/server/routes/routines.ts`
- **New Function**: `getRoutineImageRoute(req, res)`
  - Extract `imageId` from `req.params.id`
  - Get userId from request
  - Call `getRoutineImage(imageId, userId)`
  - Set `Content-Type` header from stored `contentType`
  - Send image buffer: `res.send(image.data)`
  - Handle 404 if not found

**3.2 Register Route**
- **File**: `src/server/index.ts`
- **Add**: `app.get('/api/routine-images/:id', getRoutineImageRoute)`
- **Location**: Near other routine routes (around line 109)

#### Phase 4: Update Frontend

**4.1 Update Upload Client**
- **File**: `src/lib/persistenceClient.ts`
- **Function**: `uploadRoutineImage()` (line 552)
- **Changes**:
  - Response now returns `{ imageId: string }` instead of `{ url: string }`
  - Return `imageId` instead of `url`
  - Update return type if needed

**4.2 Update Image URL Generation**
- **File**: `src/components/RoutineEditorModal.tsx`
- **Line**: 40 - After upload, convert `imageId` to URL:
  - Change: `updateStep(stepId, { imageUrl: url })`
  - To: `updateStep(stepId, { imageUrl: `/api/routine-images/${imageId}` })`

**4.3 Update Display Components**
- **File**: `src/components/RoutineRunnerModal.tsx`
- **Line**: 201 - No changes needed (already uses `imageUrl` as `src`)
- **Note**: URLs will now be `/api/routine-images/{id}` instead of `/uploads/...`

**4.4 Handle Legacy URLs (Optional Migration)**
- **Decision Point**: How to handle existing routines with `/uploads/...` URLs?
- **Option A**: Keep static serving for legacy URLs (backward compatible)
- **Option B**: Migration script to convert existing images
- **Option C**: Frontend checks URL format and handles both

#### Phase 5: Cleanup (Optional)

**5.1 Remove Static File Serving** (if no other uploads use it)
- **File**: `src/server/index.ts`
- **Line**: 41 - Check if other features use `/uploads`
- **Note**: Goals also use `saveUploadedFile()` for badges - keep static serving if badges still use filesystem

**5.2 Remove File Storage Utility** (if unused)
- **File**: `src/server/utils/fileStorage.ts`
- **Check**: Ensure goals/badges don't depend on it
- **Note**: Goals use `saveUploadedFile()` for badge images - keep utility if needed

---

## File Change Summary

### New Files
1. `src/server/repositories/routineImageRepository.ts` - Image CRUD operations

### Modified Files
1. `src/models/persistenceTypes.ts`
   - Add `ROUTINE_IMAGES` to `MONGO_COLLECTIONS`
   - (Optional) Add `RoutineImage` interface

2. `src/server/routes/routines.ts`
   - Modify `uploadRoutineImageRoute()` to use MongoDB
   - Add `getRoutineImageRoute()` for serving images
   - Remove `saveUploadedFile` import

3. `src/server/index.ts`
   - Add GET route for image serving

4. `src/lib/persistenceClient.ts`
   - Update `uploadRoutineImage()` to handle `imageId` response

5. `src/components/RoutineEditorModal.tsx`
   - Update image URL generation after upload

### Unchanged Files (but affected)
- `src/components/RoutineRunnerModal.tsx` - No code changes, but URLs change format
- `src/server/repositories/routineRepository.ts` - No changes (still stores `imageUrl` as string)

---

## Implementation Details

### MongoDB Document Structure
```typescript
{
  _id: ObjectId,
  id: "uuid-string",           // Application-level ID
  userId: "anonymous-user",    // User scoping
  data: Binary,                // Image bytes
  contentType: "image/jpeg",   // MIME type
  createdAt: "2025-01-27T..."  // ISO timestamp
}
```

### API Changes

**Before:**
- `POST /api/upload/routine-image` → `{ url: "/uploads/routine-images/uuid.jpg" }`
- Images served via static middleware: `GET /uploads/routine-images/uuid.jpg`

**After:**
- `POST /api/upload/routine-image` → `{ imageId: "uuid-string" }`
- Images served via API: `GET /api/routine-images/{imageId}`
- Frontend constructs URL: `/api/routine-images/{imageId}`

### Backward Compatibility

**Legacy URL Handling:**
- Existing routines may have `/uploads/...` URLs
- Options:
  1. **Keep static serving** - Both old and new URLs work
  2. **Migration script** - Convert existing images to MongoDB
  3. **Frontend detection** - Check URL format and handle accordingly

**Recommendation**: Keep static serving initially, add migration later if needed.

---

## Testing Checklist

- [ ] Upload new routine image → stored in MongoDB
- [ ] Retrieve image via GET endpoint → correct content-type and data
- [ ] Display image in RoutineEditorModal → preview works
- [ ] Display image in RoutineRunnerModal → renders correctly
- [ ] Create routine with image → saved with new URL format
- [ ] Update routine with new image → old image can be deleted (optional)
- [ ] User scoping → users can only access their own images
- [ ] Error handling → 404 for missing images, 400 for invalid uploads
- [ ] File size limit → 5MB limit enforced
- [ ] Content type validation → only images accepted

---

## Migration Notes

### Data Migration (Future)
If migrating existing images:
1. Scan all routines for `/uploads/routine-images/` URLs
2. Read files from filesystem
3. Upload to MongoDB via repository
4. Update routine documents with new image IDs
5. Optionally delete old files

### Performance Considerations
- MongoDB Binary storage is efficient for < 5MB files
- Consider indexing: `{ userId: 1, id: 1 }` for fast lookups
- No GridFS overhead needed for small images

---

## Risk Assessment

**Low Risk:**
- Isolated to routine images only
- Frontend changes are minimal (URL format change)
- Backward compatible if static serving kept

**Medium Risk:**
- Need to handle legacy URLs during transition
- Image deletion cleanup (orphaned images in MongoDB)

**Mitigation:**
- Keep static file serving for backward compatibility
- Add cleanup job later for orphaned images
- Test thoroughly with existing routines

