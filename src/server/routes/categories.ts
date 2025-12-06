/**
 * Category Routes
 * 
 * REST API endpoints for Category entities.
 * Uses feature flag to enable/disable MongoDB persistence.
 */

import type { Request, Response } from 'express';
import { getUseMongoPersistence } from '../config';
import {
  createCategory,
  getCategoriesByUser,
  getCategoryById,
  updateCategory,
  deleteCategory,
  reorderCategories,
} from '../repositories/categoryRepository';
import type { Category } from '../../models/persistenceTypes';

/**
 * Get all categories for the authenticated user.
 * 
 * GET /api/categories
 */
export async function getCategories(req: Request, res: Response): Promise<void> {
  try {
    if (!getUseMongoPersistence()) {
      res.status(501).json({
        error: {
          code: 'MONGO_PERSISTENCE_DISABLED',
          message: 'MongoDB persistence is disabled. Set USE_MONGO_PERSISTENCE=true in .env to enable.',
        },
      });
      return;
    }

    // TODO: Extract userId from authentication token/session
    // For now, using a placeholder - replace with actual auth middleware
    const userId = (req as any).userId || 'anonymous-user';

    const categories = await getCategoriesByUser(userId);

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
    if (!getUseMongoPersistence()) {
      res.status(501).json({
        error: {
          code: 'MONGO_PERSISTENCE_DISABLED',
          message: 'MongoDB persistence is disabled. Set USE_MONGO_PERSISTENCE=true in .env to enable.',
        },
      });
      return;
    }

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

    // TODO: Extract userId from authentication token/session
    const userId = (req as any).userId || 'anonymous-user';

    const category = await createCategory({ name: name.trim(), color: color.trim() }, userId);

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
    if (!getUseMongoPersistence()) {
      res.status(501).json({
        error: {
          code: 'MONGO_PERSISTENCE_DISABLED',
          message: 'MongoDB persistence is disabled. Set USE_MONGO_PERSISTENCE=true in .env to enable.',
        },
      });
      return;
    }

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

    // TODO: Extract userId from authentication token/session
    const userId = (req as any).userId || 'anonymous-user';

    const category = await getCategoryById(id, userId);

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
    if (!getUseMongoPersistence()) {
      res.status(501).json({
        error: {
          code: 'MONGO_PERSISTENCE_DISABLED',
          message: 'MongoDB persistence is disabled. Set USE_MONGO_PERSISTENCE=true in .env to enable.',
        },
      });
      return;
    }

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
    const userId = (req as any).userId || 'anonymous-user';

    const category = await updateCategory(id, userId, patch);

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
    if (!getUseMongoPersistence()) {
      res.status(501).json({
        error: {
          code: 'MONGO_PERSISTENCE_DISABLED',
          message: 'MongoDB persistence is disabled. Set USE_MONGO_PERSISTENCE=true in .env to enable.',
        },
      });
      return;
    }

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

    // TODO: Extract userId from authentication token/session
    const userId = (req as any).userId || 'anonymous-user';

    // TODO: Check if category has associated habits (if cascade delete not implemented)
    // For now, we allow deletion (matches current frontend behavior)

    const deleted = await deleteCategory(id, userId);

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
    if (!getUseMongoPersistence()) {
      res.status(501).json({
        error: {
          code: 'MONGO_PERSISTENCE_DISABLED',
          message: 'MongoDB persistence is disabled. Set USE_MONGO_PERSISTENCE=true in .env to enable.',
        },
      });
      return;
    }

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
    const userId = (req as any).userId || 'anonymous-user';

    const updatedCategories = await reorderCategories(userId, categories as Category[]);

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

