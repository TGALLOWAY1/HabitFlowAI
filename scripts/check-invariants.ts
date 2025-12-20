#!/usr/bin/env tsx
/**
 * Invariant Checker
 * 
 * Scans the codebase for forbidden persistence patterns:
 * - Stored completion/progress fields
 * - Legacy DayLog writes
 * - HabitEntry date persistence
 * - Activity naming leakage (comprehensive ban - should use Routine)
 * 
 * Exclusions:
 * - Test files (__tests__/, *.test.*)
 * - Documentation (docs/, reference/)
 * - This script itself
 * - node_modules
 * 
 * Activity naming exceptions (allowed):
 * - Legacy data handling in dayLogRepository (backward compatibility)
 * - Activity icon from lucide-react (third-party library)
 * - General activity terms (inactivityWarning, activityTab, "Activity Heatmap", etc.)
 * - Predefined habit names (user-facing data)
 * - Comments explaining renames
 * 
 * Run with: npm run check:invariants
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const PROJECT_ROOT = process.cwd();
const SERVER_DIR = join(PROJECT_ROOT, 'src/server');

// Forbidden persistence fields (completion/progress)
const FORBIDDEN_FIELDS = [
    'isComplete',
    'completed', // Note: completedAt (timestamp) is OK for Goal
    'isCompleted',
    'completion',
    'progress', // When used as stored field, not derived local var
    'currentValue', // When stored, not computed
    'percent', // When stored, not computed
    'streak',
    'momentum',
    'totals',
    'weeklyProgress',
    'dailyProgress',
    'goalProgress',
    'completedOptions',
];

// Forbidden legacy stores (direct product flow writes)
const FORBIDDEN_LEGACY = [
    '/api/dayLogs', // API endpoint (write routes are deprecated)
    'saveDayLog', // Write function (should be removed)
];

// Forbidden Activity naming (should use Routine instead)
// Comprehensive ban on all activity* patterns in runtime code
const FORBIDDEN_ACTIVITY_PATTERNS = [
    { pattern: /\bactivity\b/i, name: 'activity (word)' },
    { pattern: /\bactivities\b/i, name: 'activities (word)' },
    { pattern: /\bActivity\b/, name: 'Activity (capitalized)' },
    { pattern: /\bActivities\b/, name: 'Activities (capitalized)' },
    { pattern: /\bactivityId\b/, name: 'activityId' },
    { pattern: /\bactivity_id\b/, name: 'activity_id' },
    { pattern: /\bActivityRunner\b/, name: 'ActivityRunner' },
    { pattern: /\bActivityModal\b/, name: 'ActivityModal' },
    { pattern: /\bactivityService\b/, name: 'activityService' },
    { pattern: /\bActivityContext\b/, name: 'ActivityContext' },
    { pattern: /\bActivityList\b/, name: 'ActivityList' },
    { pattern: /\/api\/activities/, name: '/api/activities' },
];

// Patterns that indicate persistence writes
const WRITE_PATTERNS = [
    /insertOne\s*\(/,
    /updateOne\s*\(/,
    /updateMany\s*\(/,
    /findOneAndUpdate\s*\(/,
    /findOneAndReplace\s*\(/,
    /replaceOne\s*\(/,
    /\.save\s*\(/,
    /\.create\s*\(/,
    /\.update\s*\(/,
    /collection\s*\([^)]+\)\s*\.(insert|update|replace)/,
];

// Patterns that indicate date persistence in HabitEntry
const DATE_PERSISTENCE_PATTERNS = [
    /date:\s*(dayKey|entry\.dayKey|normalizedPayload\.dayKey)/, // Writing date field
    /date:\s*[^,}\]]+/, // Any date assignment in object literals
];

interface Violation {
    file: string;
    line: number;
    content: string;
    type: 'forbidden_field' | 'legacy_store' | 'date_persistence';
    field?: string;
}

const violations: Violation[] = [];

/**
 * Check if a line is in a comment or string literal
 */
function isInCommentOrString(line: string, index: number): boolean {
    const before = line.substring(0, index);
    
    // Check for single-line comment
    if (before.includes('//')) {
        const commentIndex = before.lastIndexOf('//');
        const stringBeforeComment = before.substring(0, commentIndex);
        // If there's an unclosed string before the comment, it's not a comment
        const singleQuotes = (stringBeforeComment.match(/'/g) || []).length;
        const doubleQuotes = (stringBeforeComment.match(/"/g) || []).length;
        if (singleQuotes % 2 === 0 && doubleQuotes % 2 === 0) {
            return true; // It's a comment
        }
    }
    
    // Check for multi-line comment start
    if (before.includes('/*') && !before.includes('*/')) {
        return true;
    }
    
    return false;
}

/**
 * Check if file should be excluded from scanning
 */
function shouldExcludeFile(filePath: string): boolean {
    const relativePath = relative(PROJECT_ROOT, filePath);
    
    // Exclude test files (they may test guardrails or use legacy terms in fixtures)
    if (relativePath.includes('__tests__') || relativePath.includes('.test.')) {
        return true;
    }
    
    // Exclude this script
    if (relativePath.includes('check-invariants')) {
        return true;
    }
    
    // Exclude documentation (reference docs, historical docs, etc.)
    if (relativePath.includes('docs/') || relativePath.includes('reference/')) {
        return true;
    }
    
    // Exclude node_modules
    if (relativePath.includes('node_modules')) {
        return true;
    }
    
    return false;
}

/**
 * Check if a violation is in a write context (not just a read)
 */
function isInWriteContext(line: string, field: string): boolean {
    // Check if this line contains write patterns
    const hasWritePattern = WRITE_PATTERNS.some(pattern => pattern.test(line));
    
    // Check if field appears in object literal being written
    // Look for patterns like: { field: value } or { ...obj, field: value }
    const fieldPattern = new RegExp(`\\b${field}\\s*:`, 'i');
    const hasFieldAssignment = fieldPattern.test(line);
    
    // Also check for field in function call arguments (e.g., createHabitEntry({ field: ... }))
    const functionCallPattern = new RegExp(`(create|update|upsert|insert).*\\{[^}]*${field}\\s*:`, 'i');
    const hasFunctionCallWithField = functionCallPattern.test(line);
    
    // For date persistence, check if date is being assigned in an object literal
    if (field === 'date') {
        // Look for date: in object literals (not just type definitions)
        const dateAssignmentPattern = /(?:^|\{|,)\s*date\s*:\s*[^,}\]]+/;
        return (dateAssignmentPattern.test(line) && hasWritePattern) || hasFunctionCallWithField;
    }
    
    return (hasWritePattern && hasFieldAssignment) || hasFunctionCallWithField;
}

/**
 * Scan a file for violations
 */
function scanFile(filePath: string): void {
    if (shouldExcludeFile(filePath)) {
        return;
    }
    
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
        const lineNum = index + 1;
        const trimmedLine = line.trim();
        
        // Skip empty lines
        if (!trimmedLine) return;
        
        // Check for forbidden fields in write contexts
        FORBIDDEN_FIELDS.forEach(field => {
            const fieldPattern = new RegExp(`\\b${field}\\b`, 'i');
            const match = fieldPattern.exec(line);
            
            if (match) {
                const matchIndex = match.index;
                
                // Skip if in comment or string
                if (isInCommentOrString(line, matchIndex)) {
                    return;
                }
                
                // Check if this is a write context (not just a read/type definition)
                if (isInWriteContext(line, field)) {
                    violations.push({
                        file: relative(PROJECT_ROOT, filePath),
                        line: lineNum,
                        content: trimmedLine,
                        type: 'forbidden_field',
                        field,
                    });
                }
            }
        });
        
        // Check for legacy DayLog writes
        FORBIDDEN_LEGACY.forEach(legacy => {
            const legacyPattern = new RegExp(`\\b${legacy}\\b`, 'i');
            const match = legacyPattern.exec(line);
            
            if (match) {
                const matchIndex = match.index;
                
                // Skip if in comment or string
                if (isInCommentOrString(line, matchIndex)) {
                    return;
                }
                
                // Check if this is a write context
                // Allow DayLog functions in recomputeUtils (derived data recomputation) and cleanup contexts
                const isRecomputeContext = filePath.includes('recomputeUtils') || 
                                          filePath.includes('recompute');
                const isCleanupContext = line.includes('deleteDayLogsByHabit') && 
                                       (line.includes('Cascade') || line.includes('cleanup') || filePath.includes('habits.ts'));
                const isAllowedContext = isRecomputeContext || isCleanupContext;
                
                // Only flag if it's a direct write (not in recompute/cleanup context)
                if (!isAllowedContext && (isInWriteContext(line, legacy) || 
                    line.includes('upsertDayLog') || 
                    line.includes('saveDayLog') || 
                    (line.includes('deleteDayLog') && !line.includes('deleteDayLogsByHabit')))) {
                    violations.push({
                        file: relative(PROJECT_ROOT, filePath),
                        line: lineNum,
                        content: trimmedLine,
                        type: 'legacy_store',
                        field: legacy,
                    });
                }
            }
        });
        
        // Check for Activity naming leakage (should use Routine)
        FORBIDDEN_ACTIVITY_PATTERNS.forEach(({ pattern, name }) => {
            const match = pattern.exec(line);
            
            if (match) {
                const matchIndex = match.index;
                
                // Skip if in comment or string
                if (isInCommentOrString(line, matchIndex)) {
                    return;
                }
                
                // Allow activityId in legacy data handling context (dayLogRepository)
                // This is the only place where activityId should appear - for backward compatibility
                const isLegacyDataHandling = filePath.includes('dayLogRepository') && 
                                           (line.includes('legacy') || line.includes('Legacy') || 
                                            (line.includes('activityId') && line.includes('routineId')));
                
                // Allow "Activity" icon from lucide-react (third-party library)
                // Check if Activity is imported from lucide-react in the file
                const isIconImport = line.includes("from 'lucide-react'") || 
                                   line.includes("from \"lucide-react\"") ||
                                   line.match(/import\s+.*Activity.*from\s+['"]lucide-react['"]/);
                
                // Also check if this file imports Activity from lucide-react (for JSX usage)
                // We'll check the full file content for the import
                let fileHasIconImport = false;
                try {
                    const fileContent = readFileSync(filePath, 'utf-8');
                    fileHasIconImport = /import\s+.*\{[^}]*Activity[^}]*\}\s+from\s+['"]lucide-react['"]/.test(fileContent) ||
                                      /import\s+.*Activity\s+from\s+['"]lucide-react['"]/.test(fileContent);
                } catch (e) {
                    // If we can't read the file, skip this check
                }
                
                // Allow general activity terms (not Activity entity):
                // - inactivityWarning (goal inactivity, not Activity entity)
                // - activityTab (general activity tab, not Activity entity)
                // - "Activity Heatmap" (general activity visualization, not Activity entity)
                // - "No activity yet" (general activity message, not Activity entity)
                // - "recent activity" (general activity description, not Activity entity)
                // - "activity counts" (general activity metrics, not Activity entity)
                // - "Activity" as a UI label (general activity section header)
                const isGeneralActivity = line.includes('inactivityWarning') || 
                                        line.includes('activityTab') ||
                                        line.includes('Activity Heatmap') ||
                                        line.includes('No activity yet') ||
                                        line.includes('recent activity') ||
                                        line.includes('activity counts') ||
                                        line.includes('global activity') ||
                                        (line.includes('Activity') && line.includes('text-white') && line.includes('font-bold')); // UI section header
                
                // Allow predefined habit names (user-facing data, not code)
                const isPredefinedHabit = filePath.includes('predefinedHabits') && 
                                        (line.includes('Activity for Lady') || 
                                         line.includes('Social Activity'));
                
                // Allow comment explaining rename (e.g., "Renamed from activities")
                const isRenameComment = line.includes('Renamed from') || 
                                       line.includes('formerly Activity');
                
                if (!isLegacyDataHandling && !isIconImport && !fileHasIconImport && !isGeneralActivity && 
                    !isPredefinedHabit && !isRenameComment) {
                    violations.push({
                        file: relative(PROJECT_ROOT, filePath),
                        line: lineNum,
                        content: trimmedLine,
                        type: 'legacy_store',
                        field: name,
                    });
                }
            }
        });
        
        // Check for date persistence in HabitEntry writes
        // Look for date: assignments in object literals that are being written
        if (line.includes('date:') && !line.includes('//') && !line.includes('*')) {
            // Check if this is in a write context
            const hasWritePattern = WRITE_PATTERNS.some(pattern => pattern.test(line));
            const isHabitEntryContext = line.includes('HabitEntry') || 
                                       filePath.includes('habitEntry') ||
                                       line.includes('createHabitEntry') ||
                                       line.includes('updateHabitEntry') ||
                                       line.includes('upsertHabitEntry');
            
            // Exclude if it's a type definition or comment
            if (line.includes('interface') || line.includes('type ') || line.includes('@deprecated')) {
                return;
            }
            
            // Check if date is being assigned (not just read)
            if (hasWritePattern && isHabitEntryContext && /date\s*:\s*[^,}\]]+/.test(line)) {
                // Allow if it's explicitly removing date: const { date: _, ... } = ...
                if (line.includes('date: _') || line.includes('date: _,')) {
                    return;
                }
                
                violations.push({
                    file: relative(PROJECT_ROOT, filePath),
                    line: lineNum,
                    content: trimmedLine,
                    type: 'date_persistence',
                    field: 'date',
                });
            }
        }
    });
}

/**
 * Recursively scan directory
 */
function scanDirectory(dir: string): void {
    const entries = readdirSync(dir);
    
    entries.forEach(entry => {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
            // Skip node_modules and dist
            if (entry === 'node_modules' || entry === 'dist' || entry === '.git') {
                return;
            }
            scanDirectory(fullPath);
        } else if (stat.isFile() && (entry.endsWith('.ts') || entry.endsWith('.tsx'))) {
            scanFile(fullPath);
        }
    });
}

/**
 * Main execution
 */
function main(): void {
    console.log('🔍 Scanning for invariant violations...\n');
    console.log('📋 Checking:');
    console.log('  - Forbidden persistence fields (completion/progress)');
    console.log('  - Legacy DayLog writes');
    console.log('  - HabitEntry date persistence');
    console.log('  - Activity naming leakage (activity* → routine*)\n');
    
    // Scan server directory (repositories and routes)
    scanDirectory(join(SERVER_DIR, 'repositories'));
    scanDirectory(join(SERVER_DIR, 'routes'));
    
    // Also scan frontend source for Activity naming (but exclude test files)
    scanDirectory(join(PROJECT_ROOT, 'src/components'));
    scanDirectory(join(PROJECT_ROOT, 'src/store'));
    scanDirectory(join(PROJECT_ROOT, 'src/lib'));
    scanDirectory(join(PROJECT_ROOT, 'src/models'));
    
    // Report results
    if (violations.length === 0) {
        console.log('✅ No invariant violations found!\n');
        process.exit(0);
    } else {
        console.error(`❌ Found ${violations.length} invariant violation(s):\n`);
        
        violations.forEach((violation, index) => {
            const typeLabel = {
                'forbidden_field': '🚫 Forbidden Field',
                'legacy_store': '⚠️  Legacy Store / Activity Naming',
                'date_persistence': '📅 Date Persistence',
            }[violation.type];
            
            console.error(`${index + 1}. ${typeLabel}: ${violation.field || 'unknown'}`);
            console.error(`   File: ${violation.file}:${violation.line}`);
            console.error(`   Line: ${violation.content}`);
            console.error('');
        });
        
        console.error('💡 Fix these violations before committing.\n');
        process.exit(1);
    }
}

main();

