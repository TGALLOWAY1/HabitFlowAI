import type { Request, Response } from 'express';
import { getCategoriesByUser } from '../repositories/categoryRepository';
import { getHabitEntriesByUser } from '../repositories/habitEntryRepository';
import { getHabitsByUser } from '../repositories/habitRepository';
import { assertTimeZone } from '../domain/canonicalValidators';
import { buildMainDashboardReadModel } from '../services/dashboardReadModel';
import type { DashboardCadenceFilter } from '../../types/mainDashboard';

function parseCadence(value: unknown): DashboardCadenceFilter {
  if (value === 'daily' || value === 'weekly' || value === 'all') {
    return value;
  }
  return 'all';
}

function parseIncludeWeekly(value: unknown): boolean {
  if (value === 'false') return false;
  return true;
}

export async function getMainDashboardRoute(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).userId || 'anonymous-user';
    const { month, categoryId, cadence, includeWeekly, timeZone } = req.query;

    if (!month || typeof month !== 'string') {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'month is required (YYYY-MM)',
        },
      });
      return;
    }

    const resolvedTimeZone = typeof timeZone === 'string' ? timeZone : 'UTC';
    const timeZoneValidation = assertTimeZone(resolvedTimeZone);

    if (!timeZoneValidation.valid) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: timeZoneValidation.error,
        },
      });
      return;
    }

    const [habits, categories, entries] = await Promise.all([
      getHabitsByUser(userId),
      getCategoriesByUser(userId),
      getHabitEntriesByUser(userId),
    ]);

    const response = buildMainDashboardReadModel({
      habits,
      categories,
      entries,
      query: {
        month,
        categoryId: typeof categoryId === 'string' && categoryId.trim().length > 0 ? categoryId : undefined,
        cadence: parseCadence(cadence),
        includeWeekly: parseIncludeWeekly(includeWeekly),
        timeZone: resolvedTimeZone,
      },
    });

    res.status(200).json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to build dashboard';
    const isValidationError = message.includes('month must be in YYYY-MM format');

    res.status(isValidationError ? 400 : 500).json({
      error: {
        code: isValidationError ? 'VALIDATION_ERROR' : 'INTERNAL_SERVER_ERROR',
        message,
      },
    });
  }
}
