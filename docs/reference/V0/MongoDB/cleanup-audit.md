> ⚠️ Status: Historical PRD (v0)
>
> This document reflects earlier design intent and may reference
> legacy concepts or naming (e.g., Activity, DayLog).
>
> Canonical behavior is defined in:
> /docs/canonical/Canonical Domain Rules.md


# Cleanup Audit - HabitFlowAI

**Date:** 2025-01-27  
**Purpose:** Comprehensive audit of remnants from old localStorage-based persistence and multi-mode migration system

---

## Executive Summary

The app has been migrated to **Mongo-only** persistence. This audit identifies all remaining artifacts from the old system that should be cleaned up.

**Status Categories:**
- ✅ **Still relevant** - Keep as-is (e.g., test mocks, backend config)
- 🔧 **Needs adjustment** - Update comments/docs to reflect Mongo-only reality
- 🗑️ **Safe to delete** - Obsolete code/docs that can be removed

---

## Code Artifacts

### Frontend Code

#### `src/lib/persistenceConfig.ts`
- ✅ **`MONGO_ENABLED`** - Still relevant (Mongo enable/disable flag)
- ✅ **`isMongoPrimary()`** - Still relevant (but name is misleading - it's just checking if Mongo is enabled)
  - 🔧 **Action:** Consider renaming to `isMongoEnabled()` for clarity
- ✅ **`API_BASE_URL`** - Still relevant
- ✅ **`getApiBaseUrl()`** - Still relevant
- ✅ **Comment mentioning "Mongo-primary mode"** - 🔧 **Needs adjustment:** Update to say "Mongo-only mode"

#### `src/store/HabitContext.tsx`
- ✅ **Comment on line 54:** "localStorage-based persistence is no longer supported" - ✅ Still accurate
- ✅ **All state initialization** - ✅ Still relevant (starts empty, loads from Mongo)
- ✅ **All useEffect hooks** - ✅ Still relevant (fetch from Mongo only)
- ✅ **All write functions** - ✅ Still relevant (Mongo-only)

#### `src/lib/persistenceClient.ts`
- ✅ **All functions** - ✅ Still relevant (Mongo API client)
- 🔧 **Error messages mentioning `VITE_USE_MONGO_PERSISTENCE=false`** - ✅ Still accurate (explains how to disable)
- ✅ **`MONGO_ENABLED` checks** - ✅ Still relevant
- 🗑️ **Line 423:** `export { isMongoPersistenceEnabled } from './persistenceConfig'` - 🗑️ **Safe to delete:** This function no longer exists in `persistenceConfig.ts` (only used in obsolete test file)

#### `src/models/persistenceTypes.ts`
- 🔧 **Line 303 comment:** "Note: Different from localStorage key 'logs'" - 🗑️ **Safe to delete:** No longer relevant
- ✅ **`MONGO_COLLECTIONS` constant** - ✅ Still relevant (used by backend)

#### `src/components/CategoryTabs.tsx`
- 🔧 **Line 153 comment:** "Category might still be added via localStorage fallback" - 🗑️ **Safe to delete:** Obsolete comment

#### `src/components/DailyCheckInModal.tsx`
- 🔧 **Line 63 comment:** "Still close modal even if API fails (fallback to localStorage)" - 🗑️ **Safe to delete:** Obsolete comment

#### `src/components/AddHabitModal.tsx`
- 🔧 **Line 40 comment:** "Still close modal even if API fails (fallback to localStorage)" - 🗑️ **Safe to delete:** Obsolete comment

#### `src/store/__tests__/HabitContext.categories.test.tsx`
- 🗑️ **Entire test file** - 🗑️ **Safe to delete:** Tests for localStorage-only and dual-write modes that no longer exist
  - Tests localStorage-only mode (line 53)
  - Tests dual-write behavior
  - Tests localStorage fallback
  - All of these are obsolete

#### `src/test/setup.ts`
- ✅ **localStorage mock** - ✅ Still relevant (needed for test environment, even if tests don't use localStorage for persistence)

### Backend Code

#### `src/server/config/index.ts`
- ✅ **`USE_MONGO_PERSISTENCE`** - ✅ Still relevant (backend feature flag)
- ✅ **`getUseMongoPersistence()`** - ✅ Still relevant
- 🔧 **Comment on line 11:** "When false, repository functions will throw 'not implemented' errors" - 🔧 **Needs adjustment:** Update to clarify this is expected behavior (Mongo is required)

#### `src/server/repositories/*.ts`
- ✅ **All repository functions** - ✅ Still relevant
- 🔧 **Error messages mentioning `USE_MONGO_PERSISTENCE=true`** - 🔧 **Needs adjustment:** Update to say "MongoDB persistence is required" or similar (less about enabling, more about it being the only option)

#### `src/server/routes/*.ts`
- ✅ **All route handlers** - ✅ Still relevant
- 🔧 **Error messages mentioning `USE_MONGO_PERSISTENCE=true`** - 🔧 **Needs adjustment:** Same as repositories

#### `src/server/repositories/README.md`
- 🔧 **Line 3:** "Uses feature flags to switch between MongoDB persistence and local storage (when implemented)" - 🗑️ **Safe to delete/update:** Obsolete - local storage will never be implemented
- 🔧 **Line 20-23:** Mentions feature flag behavior with localStorage fallback - 🔧 **Needs adjustment:** Update to reflect Mongo-only reality

---

## Documentation Artifacts

### Obsolete Docs (Can be deleted)

#### `docs/storage-audit.md`
- 🗑️ **Status:** Obsolete
- **Reason:** Documents localStorage persistence system that no longer exists
- **Content:** 791 lines describing localStorage keys, data shapes, read/write lifecycles
- **Action:** Delete entire file (historical context not needed)

#### `docs/storage-audit-drift.md`
- 🗑️ **Status:** Obsolete
- **Reason:** Verification doc for localStorage persistence mechanisms
- **Content:** 189 lines checking for hidden localStorage usage
- **Action:** Delete entire file

#### `docs/runtime-persistence-map.md`
- 🗑️ **Status:** Obsolete
- **Reason:** Maps dual-path persistence (localStorage + Mongo) that no longer exists
- **Content:** 454 lines describing how entities use localStorage vs Mongo
- **Action:** Delete entire file

#### `docs/mongo-migration-test-plan.md`
- 🗑️ **Status:** Obsolete
- **Reason:** Test plan for migration from localStorage to Mongo (migration is complete)
- **Content:** 542 lines of test scenarios for localStorage-only and migration modes
- **Action:** Delete entire file

### Partially Obsolete Docs (Needs content update)

#### `docs/mongo-migration-plan.md`
- 🔧 **Status:** Partially obsolete
- **Reason:** Migration is complete, but document has historical value
- **Current state:** Already has note at top saying it's historical
- **Action:** ✅ Already marked as historical - keep as-is for reference

### Still Accurate Docs

#### `docs/persistence-overview.md`
- ✅ **Status:** Still accurate
- **Reason:** New doc describing Mongo-only architecture
- **Action:** Keep as-is

#### `docs/mongo-architecture-plan.md`
- ✅ **Status:** Likely still accurate (need to verify)
- **Action:** Review to ensure it describes Mongo-only architecture

#### `docs/mongodb-setup.md`
- ✅ **Status:** Likely still accurate
- **Action:** Review to ensure it's still relevant

#### `docs/mongodb-verification.md`
- ✅ **Status:** Likely still accurate
- **Action:** Review to ensure it's still relevant

---

## Config/Env Artifacts

### Frontend Environment Variables

#### `VITE_USE_MONGO_PERSISTENCE`
- ✅ **Status:** Still relevant
- **Current behavior:** Defaults to `true`, can be set to `false` to disable Mongo
- **Action:** Keep as-is (useful for dev/testing scenarios)

### Backend Environment Variables

#### `USE_MONGO_PERSISTENCE`
- ✅ **Status:** Still relevant
- **Current behavior:** Must be `true` for app to work (Mongo is required)
- 🔧 **Action:** Consider renaming to `MONGODB_ENABLED` or similar for clarity, OR document that it's required (not optional)
- **Note:** Error messages suggest it's optional, but it's actually required

---

## Test Artifacts

### `src/store/__tests__/HabitContext.categories.test.tsx`
- 🗑️ **Status:** Obsolete
- **Reason:** Tests localStorage-only mode and dual-write behavior that no longer exist
- **Content:** 
  - Tests for "LocalStorage-only mode"
  - Tests for "MongoDB mode" with dual-write
  - Tests for localStorage fallback
- **Action:** Delete entire file (340+ lines)

### Other test files
- ✅ **Backend repository tests** - ✅ Still relevant (test Mongo persistence)
- ✅ **Route tests** - ✅ Still relevant (test API endpoints)
- ✅ **Test setup with localStorage mock** - ✅ Still relevant (needed for test environment)

---

## Summary of Actions

### High Priority (Safe to delete now)

1. 🗑️ Delete `docs/storage-audit.md` (791 lines)
2. 🗑️ Delete `docs/storage-audit-drift.md` (189 lines)
3. 🗑️ Delete `docs/runtime-persistence-map.md` (454 lines)
4. 🗑️ Delete `docs/mongo-migration-test-plan.md` (542 lines)
5. 🗑️ Delete `src/store/__tests__/HabitContext.categories.test.tsx` (340+ lines)

### Medium Priority (Needs adjustment)

1. 🗑️ Remove broken export in `src/lib/persistenceClient.ts` (line 423): `export { isMongoPersistenceEnabled }` - function doesn't exist
2. 🔧 Update comments in `src/components/CategoryTabs.tsx` (line 153)
3. 🔧 Update comments in `src/components/DailyCheckInModal.tsx` (line 63)
4. 🔧 Update comments in `src/components/AddHabitModal.tsx` (line 40)
5. 🔧 Remove obsolete comment in `src/models/persistenceTypes.ts` (line 303)
6. 🔧 Update `src/server/repositories/README.md` to remove localStorage references
7. 🔧 Update error messages in backend to reflect Mongo is required (not optional)

### Low Priority (Consider for clarity)

1. 🔧 Consider renaming `isMongoPrimary()` to `isMongoEnabled()` in `persistenceConfig.ts`
2. 🔧 Update comment in `persistenceConfig.ts` to say "Mongo-only mode" instead of "Mongo-primary mode"
3. 🔧 Consider renaming `USE_MONGO_PERSISTENCE` to `MONGODB_ENABLED` on backend (or document it's required)

---

## Estimated Impact

- **Files to delete:** 5 files (~2,316 lines)
- **Files to update:** ~8 files (minor comment/doc updates)
- **Risk level:** Low (all changes are cleanup of obsolete code/docs)

---

**Next Steps:** Apply cleanup in small, safe steps as outlined in the cleanup plan.
