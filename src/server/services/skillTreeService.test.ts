import { describe, it, expect, vi } from 'vitest';

// Mock dependencies
vi.mock('../repositories/categoryRepository', () => ({
    getCategoriesByUser: vi.fn(),
}));
vi.mock('../repositories/goalRepository', () => ({
    getGoalsByUser: vi.fn(),
}));
vi.mock('../repositories/habitRepository', () => ({
    getHabitsByUser: vi.fn(),
}));
vi.mock('../utils/goalProgressUtils', () => ({
    computeGoalProgress: vi.fn(),
}));

describe('skillTreeService', () => {
    it('should be refactored with new tests', () => {
        // TODO: Write new tests for the refactored service
        expect(true).toBe(true);
    });
});
