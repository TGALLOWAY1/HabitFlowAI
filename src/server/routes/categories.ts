/**
 * Category Routes
 * 
 * REST API endpoints for Category entities.
 * Uses feature flag to enable/disable MongoDB persistence.
 */

import type { Request, Response } from 'express';
import {
  createCategory,
  getCategoriesByUser,
  getCategoryById,
  updateCategory,
  deleteCategory,
  reorderCategories,
} from '../repositories/categoryRepository';
import { uncategorizeHabitsByCategory } from '../repositories/habitRepository';
import type { Category } from '../../models/persistenceTypes';
import { getRequestIdentity } from '../middleware/identity';

/** Normalize category name for duplicate check: trim, collapse spaces, lowercase. */
function normalizeCategoryName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Get all categories for the authenticated user.
 * GET /api/categories
 */
export async function getCategories(req: Request, res: Response): Promise<void> {
  try {
    const { householdId, userId } = getRequestIdentity(req);
    const categories = await getCategoriesByUser(householdId, userId);

    res.status(200).json({
      categories,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching categories:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch categories',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

/**
 * Create a new category.
 * 
 * POST /api/categories
 */
export async function createCategoryRoute(req: Request, res: Response): Promise<void> {
  try {

    // Validate request body
    const { name, color } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Category name is required and must be a non-empty string',
        },
      });
      return;
    }

    if (!color || typeof color !== 'string' || color.trim().length === 0) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Category color is required and must be a non-empty string',
        },
      });
      return;
    }

    const { householdId, userId } = getRequestIdentity(req);
    const trimmedName = name.trim();
    const normalizedNew = normalizeCategoryName(trimmedName);
    const existingCategories = await getCategoriesByUser(householdId, userId);
    const duplicate = existingCategories.some(
      (c) => normalizeCategoryName(c.name) === normalizedNew
    );
    if (duplicate) {
      res.status(409).json({
        error: {
          code: 'CONFLICT',
          message: 'Category already exists. Choose a different name.',
        },
      });
      return;
    }
    const category = await createCategory({ name: trimmedName, color: color.trim() }, householdId, userId);

    res.status(201).json({
      category,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating category:', errorMessage);

    // Check if it's a duplicate name error (if we implement uniqueness)
    if (errorMessage.includes('duplicate') || errorMessage.includes('already exists')) {
      res.status(409).json({
        error: {
          code: 'CONFLICT',
          message: 'Category with this name already exists',
        },
      });
      return;
    }

    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create category',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

/**
 * Get a single category by ID.
 * 
 * GET /api/categories/:id
 */
export async function getCategory(req: Request, res: Response): Promise<void> {
  try {

    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Category ID is required',
        },
      });
      return;
    }

    const { householdId, userId } = getRequestIdentity(req);
    const category = await getCategoryById(id, householdId, userId);

    if (!category) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Category not found',
        },
      });
      return;
    }

    res.status(200).json({
      category,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching category:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch category',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

/**
 * Update a category.
 * 
 * PATCH /api/categories/:id
 */
export async function updateCategoryRoute(req: Request, res: Response): Promise<void> {
  try {

    const { id } = req.params;
    const { name, color } = req.body;

    if (!id) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Category ID is required',
        },
      });
      return;
    }

    // Validate update data
    const patch: Partial<Omit<Category, 'id'>> = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Category name must be a non-empty string',
          },
        });
        return;
      }
      patch.name = name.trim();
    }

    if (color !== undefined) {
      if (typeof color !== 'string' || color.trim().length === 0) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Category color must be a non-empty string',
          },
        });
        return;
      }
      patch.color = color.trim();
    }

    if (Object.keys(patch).length === 0) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'At least one field (name or color) must be provided for update',
        },
      });
      return;
    }

    // TODO: Extract userId from authentication token/session
    const { householdId, userId } = getRequestIdentity(req);
    const category = await updateCategory(id, householdId, userId, patch);

    if (!category) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Category not found',
        },
      });
      return;
    }

    res.status(200).json({
      category,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error updating category:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update category',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

/**
 * Delete a category.
 * 
 * DELETE /api/categories/:id
 */
export async function deleteCategoryRoute(req: Request, res: Response): Promise<void> {
  try {

    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Category ID is required',
        },
      });
      return;
    }

    const { householdId, userId } = getRequestIdentity(req);

    // Make all habits in this category "uncategorized" by clearing their categoryId.
    // This keeps them visible and accessible so users can reassign or delete them.
    const uncategorizedCount = await uncategorizeHabitsByCategory(id, householdId, userId);

    const deleted = await deleteCategory(id, householdId, userId);

    if (!deleted) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Category not found',
        },
      });
      return;
    }

    res.status(200).json({
      message: 'Category deleted successfully',
      uncategorizedHabits: uncategorizedCount,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error deleting category:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete category',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

/**
 * Reorder categories.
 * 
 * PATCH /api/categories/reorder
 */
export async function reorderCategoriesRoute(req: Request, res: Response): Promise<void> {
  try {

    const { categories } = req.body;

    if (!Array.isArray(categories)) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Categories must be an array',
        },
      });
      return;
    }

    // Validate each category in the array
    for (const category of categories) {
      if (!category.id || typeof category.id !== 'string') {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Each category must have a valid id',
          },
        });
        return;
      }

      if (!category.name || typeof category.name !== 'string') {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Each category must have a valid name',
          },
        });
        return;
      }

      if (!category.color || typeof category.color !== 'string') {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Each category must have a valid color',
          },
        });
        return;
      }
    }

    // TODO: Extract userId from authentication token/session
    const { householdId, userId } = getRequestIdentity(req);
    const updatedCategories = await reorderCategories(householdId, userId, categories as Category[]);

    res.status(200).json({
      categories: updatedCategories,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error reordering categories:', errorMessage);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to reorder categories',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
    });
  }
}

