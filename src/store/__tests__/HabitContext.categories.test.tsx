/**
 * HabitContext Category Operations Tests
 * 
 * Tests for category operations with dual-path persistence (localStorage and MongoDB).
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import { HabitProvider, useHabitStore } from '../HabitContext';
import type { Category } from '../../models/persistenceTypes';

// Mock the persistence client
vi.mock('../../lib/persistenceClient', () => {
  const mockCategories: Category[] = [
    { id: 'api-1', name: 'API Category 1', color: 'bg-red-500' },
    { id: 'api-2', name: 'API Category 2', color: 'bg-blue-500' },
  ];

  return {
    fetchCategories: vi.fn(),
    saveCategory: vi.fn(),
    deleteCategory: vi.fn(), // Actual export name
    reorderCategories: vi.fn(), // Actual export name
    isMongoPersistenceEnabled: vi.fn(() => false), // Default to false
  };
});

import {
  fetchCategories,
  saveCategory,
  deleteCategory as deleteCategoryApi,
  reorderCategories as reorderCategoriesApi,
  isMongoPersistenceEnabled,
} from '../../lib/persistenceClient';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <HabitProvider>{children}</HabitProvider>
);

describe('HabitContext - Category Operations', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('LocalStorage-only mode (VITE_USE_MONGO_PERSISTENCE=false)', () => {
    beforeEach(() => {
      vi.mocked(isMongoPersistenceEnabled).mockReturnValue(false);
    });

    it('should load categories from localStorage on initialization', () => {
      const savedCategories: Category[] = [
        { id: 'local-1', name: 'Local Category 1', color: 'bg-green-500' },
        { id: 'local-2', name: 'Local Category 2', color: 'bg-yellow-500' },
      ];
      localStorage.setItem('categories', JSON.stringify(savedCategories));

      const { result } = renderHook(() => useHabitStore(), { wrapper });

      expect(result.current.categories).toEqual(savedCategories);
      // Should NOT call API
      expect(fetchCategories).not.toHaveBeenCalled();
    });

    it('should use initial categories if localStorage is empty', () => {
      const { result } = renderHook(() => useHabitStore(), { wrapper });

      // Should have initial categories (8 predefined)
      expect(result.current.categories.length).toBeGreaterThan(0);
      expect(fetchCategories).not.toHaveBeenCalled();
    });

    it('should create category and save to localStorage only', async () => {
      const { result } = renderHook(() => useHabitStore(), { wrapper });

      const newCategory = { name: 'New Category', color: 'bg-purple-500' };
      await act(async () => {
        await result.current.addCategory(newCategory);
      });

      // Should have added the category
      expect(result.current.categories.length).toBeGreaterThan(0);
      const added = result.current.categories.find(c => c.name === newCategory.name);
      expect(added).toBeDefined();
      expect(added?.color).toBe(newCategory.color);

      // Should be saved to localStorage
      const saved = JSON.parse(localStorage.getItem('categories') || '[]');
      expect(saved.some((c: Category) => c.name === newCategory.name)).toBe(true);

      // Should NOT call API
      expect(saveCategory).not.toHaveBeenCalled();
    });

    it('should delete category from localStorage only', async () => {
      const savedCategories: Category[] = [
        { id: 'cat-1', name: 'Category 1', color: 'bg-red-500' },
        { id: 'cat-2', name: 'Category 2', color: 'bg-blue-500' },
      ];
      localStorage.setItem('categories', JSON.stringify(savedCategories));

      const { result } = renderHook(() => useHabitStore(), { wrapper });

      await act(async () => {
        await result.current.deleteCategory('cat-1');
      });

      // Wait for state update
      await waitFor(() => {
        expect(result.current.categories.find(c => c.id === 'cat-1')).toBeUndefined();
      });

      // Should have removed the category
      expect(result.current.categories.find(c => c.id === 'cat-2')).toBeDefined();

      // Should be updated in localStorage
      const saved = JSON.parse(localStorage.getItem('categories') || '[]');
      expect(saved.find((c: Category) => c.id === 'cat-1')).toBeUndefined();

      // Should NOT call API
      expect(deleteCategoryApi).not.toHaveBeenCalled();
    });

    it('should reorder categories in localStorage only', async () => {
      const savedCategories: Category[] = [
        { id: 'cat-1', name: 'Category 1', color: 'bg-red-500' },
        { id: 'cat-2', name: 'Category 2', color: 'bg-blue-500' },
        { id: 'cat-3', name: 'Category 3', color: 'bg-green-500' },
      ];
      localStorage.setItem('categories', JSON.stringify(savedCategories));

      const { result } = renderHook(() => useHabitStore(), { wrapper });

      const newOrder = [savedCategories[2], savedCategories[0], savedCategories[1]];
      await act(async () => {
        await result.current.reorderCategories(newOrder);
      });

      // Should have reordered
      expect(result.current.categories[0].id).toBe('cat-3');
      expect(result.current.categories[1].id).toBe('cat-1');
      expect(result.current.categories[2].id).toBe('cat-2');

      // Should be updated in localStorage
      const saved = JSON.parse(localStorage.getItem('categories') || '[]');
      expect(saved[0].id).toBe('cat-3');

      // Should NOT call API
      expect(reorderCategoriesApi).not.toHaveBeenCalled();
    });
  });

  describe('MongoDB mode (VITE_USE_MONGO_PERSISTENCE=true)', () => {
    beforeEach(() => {
      vi.mocked(isMongoPersistenceEnabled).mockReturnValue(true);
    });

    it('should fetch categories from API on mount', async () => {
      const apiCategories: Category[] = [
        { id: 'api-1', name: 'API Category 1', color: 'bg-red-500' },
        { id: 'api-2', name: 'API Category 2', color: 'bg-blue-500' },
      ];
      vi.mocked(fetchCategories).mockResolvedValue(apiCategories);

      const { result } = renderHook(() => useHabitStore(), { wrapper });

      // Wait for API call to complete
      await waitFor(() => {
        expect(fetchCategories).toHaveBeenCalled();
      });

      // Should have loaded from API
      await waitFor(() => {
        expect(result.current.categories.length).toBeGreaterThan(0);
      });

      // Should also be saved to localStorage (dual-write)
      const saved = JSON.parse(localStorage.getItem('categories') || '[]');
      expect(saved.length).toBeGreaterThan(0);
    });

    it('should fall back to localStorage if API fetch fails', async () => {
      const localCategories: Category[] = [
        { id: 'local-1', name: 'Local Category', color: 'bg-green-500' },
      ];
      localStorage.setItem('categories', JSON.stringify(localCategories));
      vi.mocked(fetchCategories).mockRejectedValue(new Error('API failed'));

      const { result } = renderHook(() => useHabitStore(), { wrapper });

      // Should fall back to localStorage
      await waitFor(() => {
        expect(result.current.categories.length).toBeGreaterThan(0);
      });

      // Should have used localStorage data
      const category = result.current.categories.find(c => c.id === 'local-1');
      expect(category).toBeDefined();
    });

    it('should create category via API and dual-write to localStorage', async () => {
      vi.mocked(fetchCategories).mockResolvedValue([]);
      const newCategoryData = { name: 'New Category', color: 'bg-purple-500' };
      const createdCategory: Category = { id: 'api-new', ...newCategoryData };
      vi.mocked(saveCategory).mockResolvedValue(createdCategory);

      const { result } = renderHook(() => useHabitStore(), { wrapper });

      await waitFor(() => {
        expect(fetchCategories).toHaveBeenCalled();
      });

      await act(async () => {
        await result.current.addCategory(newCategoryData);
      });

      // Should have called API
      expect(saveCategory).toHaveBeenCalledWith(newCategoryData);

      // Should have added to state
      await waitFor(() => {
        const added = result.current.categories.find(c => c.id === 'api-new');
        expect(added).toBeDefined();
      });

      // Should also be in localStorage (dual-write)
      const saved = JSON.parse(localStorage.getItem('categories') || '[]');
      expect(saved.some((c: Category) => c.id === 'api-new')).toBe(true);
    });

    it('should fall back to localStorage if API create fails', async () => {
      vi.mocked(fetchCategories).mockResolvedValue([]);
      const newCategoryData = { name: 'New Category', color: 'bg-purple-500' };
      vi.mocked(saveCategory).mockRejectedValue(new Error('API failed'));

      const { result } = renderHook(() => useHabitStore(), { wrapper });

      await waitFor(() => {
        expect(fetchCategories).toHaveBeenCalled();
      });

      await act(async () => {
        await result.current.addCategory(newCategoryData);
      });

      // Should have attempted API call
      expect(saveCategory).toHaveBeenCalled();

      // Should have fallen back to localStorage
      await waitFor(() => {
        const added = result.current.categories.find(c => c.name === newCategoryData.name);
        expect(added).toBeDefined();
      });

      // Should be in localStorage
      const saved = JSON.parse(localStorage.getItem('categories') || '[]');
      expect(saved.some((c: Category) => c.name === newCategoryData.name)).toBe(true);
    });

    it('should delete category via API and update localStorage', async () => {
      const existingCategories: Category[] = [
        { id: 'cat-1', name: 'Category 1', color: 'bg-red-500' },
        { id: 'cat-2', name: 'Category 2', color: 'bg-blue-500' },
      ];
      localStorage.setItem('categories', JSON.stringify(existingCategories));
      vi.mocked(fetchCategories).mockResolvedValue(existingCategories);
      // Mock deleteCategory (which is imported as deleteCategoryApi in HabitContext)
      // Access the mock through the module since we're using aliases
      const persistenceModule = await import('../../lib/persistenceClient');
      const deleteCategoryMock = vi.mocked(persistenceModule.deleteCategory);
      deleteCategoryMock.mockResolvedValue(undefined);

      const { result } = renderHook(() => useHabitStore(), { wrapper });

      await waitFor(() => {
        expect(fetchCategories).toHaveBeenCalled();
      });

      await act(async () => {
        await result.current.deleteCategory('cat-1');
      });

      // Should have called API (deleteCategoryApi is an alias for deleteCategory from the mock)
      expect(deleteCategoryMock).toHaveBeenCalledWith('cat-1');

      // Should have removed from state
      expect(result.current.categories.find(c => c.id === 'cat-1')).toBeUndefined();

      // Should be updated in localStorage
      const saved = JSON.parse(localStorage.getItem('categories') || '[]');
      expect(saved.find((c: Category) => c.id === 'cat-1')).toBeUndefined();
    });

    it('should reorder categories via API and update localStorage', async () => {
      const existingCategories: Category[] = [
        { id: 'cat-1', name: 'Category 1', color: 'bg-red-500' },
        { id: 'cat-2', name: 'Category 2', color: 'bg-blue-500' },
        { id: 'cat-3', name: 'Category 3', color: 'bg-green-500' },
      ];
      localStorage.setItem('categories', JSON.stringify(existingCategories));
      vi.mocked(fetchCategories).mockResolvedValue(existingCategories);
      const newOrder = [existingCategories[2], existingCategories[0], existingCategories[1]];
      // Mock reorderCategories (which is imported as reorderCategoriesApi in HabitContext)
      const persistenceModule = await import('../../lib/persistenceClient');
      const reorderCategoriesMock = vi.mocked(persistenceModule.reorderCategories);
      reorderCategoriesMock.mockResolvedValue(newOrder);

      const { result } = renderHook(() => useHabitStore(), { wrapper });

      await waitFor(() => {
        expect(fetchCategories).toHaveBeenCalled();
      });

      await act(async () => {
        await result.current.reorderCategories(newOrder);
      });

      // Should have called API (reorderCategoriesApi is an alias for reorderCategories from the mock)
      expect(reorderCategoriesMock).toHaveBeenCalledWith(newOrder);

      // Should have reordered in state
      await waitFor(() => {
        expect(result.current.categories[0].id).toBe('cat-3');
      });

      // Should be updated in localStorage
      const saved = JSON.parse(localStorage.getItem('categories') || '[]');
      expect(saved[0].id).toBe('cat-3');
    });
  });
});

