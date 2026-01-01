# Routine Image Handling - Code Location Findings

## All Locations Where Routine Images Are Handled

### Backend Routes & Controllers

#### 1. Upload Endpoint
- **File**: `src/server/routes/routines.ts`
- **Lines**: 453-482
- **Function**: `uploadRoutineImageRoute()`
- **Endpoint**: `POST /api/upload/routine-image`
- **Middleware**: `uploadRoutineImageMiddleware` (line 39)
- **Key Code**:
  - Line 466: `const publicUrl = saveUploadedFile(req.file, 'routine-images');`
  - Line 469: `res.status(200).json({ url: publicUrl });`

#### 2. Multer Configuration
- **File**: `src/server/routes/routines.ts`
- **Lines**: 24-37
- **Config**:
  - Storage: `multer.memoryStorage()` (line 26)
  - File size limit: 5MB (line 28)
  - File filter: Images only (lines 30-36)
- **Export**: `uploadRoutineImageMiddleware` (line 39)

#### 3. Route Registration
- **File**: `src/server/index.ts`
- **Line**: 109
- **Code**: `app.post('/api/upload/routine-image', uploadRoutineImageMiddleware, uploadRoutineImageRoute);`

### File Storage Utility

#### 4. File Storage Function
- **File**: `src/server/utils/fileStorage.ts`
- **Lines**: 31-53
- **Function**: `saveUploadedFile(file: Express.Multer.File, subdirectory: string)`
- **Storage Path**: `public/uploads/routine-images/{uuid}.{ext}` (line 38, 46)
- **Returns**: `/uploads/routine-images/{uuid}.{ext}` (line 52)

#### 5. Directory Creation
- **File**: `src/server/utils/fileStorage.ts`
- **Lines**: 18-22
- **Function**: `ensureUploadsDir()`
- **Directory**: `public/uploads` (line 12)

#### 6. File Deletion (Not currently used for routines)
- **File**: `src/server/utils/fileStorage.ts`
- **Lines**: 60-73
- **Function**: `deleteFileByUrl(urlPath: string)`
- **Note**: Exists but not called for routine images

### Static File Serving

#### 7. Express Static Middleware
- **File**: `src/server/index.ts`
- **Line**: 41
- **Code**: `app.use('/uploads', express.static('public/uploads'));`
- **Purpose**: Serves files from `public/uploads` directory

### Frontend Client

#### 8. Upload Client Function
- **File**: `src/lib/persistenceClient.ts`
- **Lines**: 552-579
- **Function**: `uploadRoutineImage(file: File): Promise<string>`
- **Endpoint**: `POST /api/upload/routine-image` (line 553)
- **Returns**: URL string from `data.url` (line 574)

### Frontend Components

#### 9. Routine Editor Modal - Upload Handler
- **File**: `src/components/RoutineEditorModal.tsx`
- **Lines**: 36-47
- **Function**: `handleImageUpload(file: File, stepId: string)`
- **Line 39**: Calls `uploadRoutineImage(file)`
- **Line 40**: Updates step with URL: `updateStep(stepId, { imageUrl: url })`

#### 10. Routine Editor Modal - Image Input
- **File**: `src/components/RoutineEditorModal.tsx`
- **Lines**: 305-338
- **Component**: Image upload input section
- **Line 333**: Manual URL input: `value={step.imageUrl || ''}`
- **Line 334**: URL change handler: `onChange={e => updateStep(step.id, { imageUrl: e.target.value })}`

#### 11. Routine Editor Modal - Image Preview
- **File**: `src/components/RoutineEditorModal.tsx`
- **Lines**: 342-357
- **Component**: Image preview display
- **Line 345**: `<img src={step.imageUrl} />`
- **Line 350**: Remove button: `onClick={() => updateStep(step.id, { imageUrl: undefined })}`

#### 12. Routine Runner Modal - Image Display
- **File**: `src/components/RoutineRunnerModal.tsx`
- **Lines**: 198-204
- **Component**: Step image display
- **Line 201**: `<img src={currentStep.imageUrl} alt={currentStep.title} />`

### Data Model

#### 13. RoutineStep Interface
- **File**: `src/models/persistenceTypes.ts`
- **Lines**: 338-365
- **Field**: `imageUrl?: string` (line 352)
- **Type**: Optional string URL

#### 14. Routine Interface
- **File**: `src/models/persistenceTypes.ts`
- **Lines**: 376-408
- **Field**: `steps: RoutineStep[]` (line 401)
- **Note**: Contains steps with `imageUrl` fields

### Repository Layer

#### 15. Routine Repository - Create
- **File**: `src/server/repositories/routineRepository.ts`
- **Lines**: 61-88
- **Function**: `createRoutine(userId, data)`
- **Note**: Stores routine with steps (including `imageUrl` strings) in MongoDB

#### 16. Routine Repository - Update
- **File**: `src/server/repositories/routineRepository.ts`
- **Lines**: 98-131
- **Function**: `updateRoutine(userId, routineId, patch)`
- **Note**: Updates routine steps (including `imageUrl` changes)

#### 17. Routine Repository - Get
- **File**: `src/server/repositories/routineRepository.ts`
- **Lines**: 40-52
- **Function**: `getRoutine(userId, routineId)`
- **Note**: Retrieves routine with steps (including `imageUrl` strings)

### Validation

#### 18. Step Validation
- **File**: `src/server/routes/routines.ts`
- **Lines**: 47-74
- **Function**: `validateRoutineStep(step, index)`
- **Line 65-67**: Validates `imageUrl` is string if provided

---

## Current Behavior Summary

### Upload Flow
1. **Frontend**: User selects image → `RoutineEditorModal.handleImageUpload()` (line 36)
2. **Frontend**: Calls `uploadRoutineImage(file)` → `persistenceClient.ts:552`
3. **Frontend**: POST to `/api/upload/routine-image` with FormData
4. **Backend**: Multer middleware processes file → `routines.ts:39`
5. **Backend**: `uploadRoutineImageRoute()` receives file → `routines.ts:453`
6. **Backend**: `saveUploadedFile()` saves to filesystem → `fileStorage.ts:31`
7. **Backend**: Returns `/uploads/routine-images/{uuid}.{ext}` → `routines.ts:469`
8. **Frontend**: Stores URL in `step.imageUrl` → `RoutineEditorModal.tsx:40`
9. **Backend**: Routine saved to MongoDB with `imageUrl` string → `routineRepository.ts:61`

### Display Flow
1. **Backend**: Routine loaded from MongoDB → `routineRepository.ts:40`
2. **Frontend**: Receives routine with `step.imageUrl` strings
3. **Frontend**: Renders `<img src={step.imageUrl} />` → `RoutineRunnerModal.tsx:201`
4. **Browser**: Requests `/uploads/routine-images/{uuid}.{ext}`
5. **Backend**: Express static middleware serves file → `index.ts:41`

### Storage Locations
- **Filesystem**: `public/uploads/routine-images/{uuid}.{ext}`
- **MongoDB**: `routines` collection → `steps[].imageUrl` (string field)
- **Static Serving**: `/uploads` → `public/uploads` directory

---

## Dependencies

### Imports
- `src/server/routes/routines.ts` imports:
  - `multer` (line 21)
  - `saveUploadedFile` from `../utils/fileStorage` (line 22)

- `src/lib/persistenceClient.ts` imports:
  - None (uses fetch API directly)

- `src/components/RoutineEditorModal.tsx` imports:
  - `uploadRoutineImage` from `../lib/persistenceClient` (line 3)

---

## Files Summary

### Backend Files (5)
1. `src/server/routes/routines.ts` - Upload endpoint, multer config, validation
2. `src/server/utils/fileStorage.ts` - File system storage utility
3. `src/server/index.ts` - Route registration, static file serving
4. `src/server/repositories/routineRepository.ts` - MongoDB persistence
5. `src/models/persistenceTypes.ts` - Data model definitions

### Frontend Files (3)
1. `src/lib/persistenceClient.ts` - Upload API client
2. `src/components/RoutineEditorModal.tsx` - Image upload UI
3. `src/components/RoutineRunnerModal.tsx` - Image display

### Total: 8 files directly involved

---

## Notes

- Goals feature also uses `saveUploadedFile()` for badge images (different subdirectory: 'badges')
- Static file serving at `/uploads` is shared by multiple features
- No image deletion logic currently implemented for routine images
- Images are stored in MongoDB as URL strings, not binary data
- File system storage is temporary until migration to MongoDB

