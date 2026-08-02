import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddHabitModal } from './AddHabitModal';

vi.mock('../store/HabitContext', () => ({ useHabitStore: vi.fn() }));
vi.mock('../store/RoutineContext', () => ({ useRoutineStore: vi.fn() }));
vi.mock('../lib/useGoalsWithProgress', () => ({ useGoalsWithProgress: vi.fn() }));

import { useHabitStore } from '../store/HabitContext';
import { useRoutineStore } from '../store/RoutineContext';
import { useGoalsWithProgress } from '../lib/useGoalsWithProgress';

describe('AddHabitModal form state', () => {
  const store = {
    addHabit: vi.fn(),
    updateHabit: vi.fn(),
    categories: [] as Array<{ id: string; name: string; color: string }>,
    habits: [],
    addCategory: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    store.categories = [];
    (useHabitStore as ReturnType<typeof vi.fn>).mockImplementation(() => store);
    (useRoutineStore as ReturnType<typeof vi.fn>).mockReturnValue({ routines: [], updateRoutine: vi.fn() });
    (useGoalsWithProgress as ReturnType<typeof vi.fn>).mockReturnValue({ data: [] });
  });

  it('preserves in-progress habit fields when categories refresh', () => {
    const { rerender } = render(<AddHabitModal isOpen onClose={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText('e.g., Morning Jog'), {
      target: { value: 'Read books' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Numeric' }));
    fireEvent.change(screen.getByPlaceholderText('e.g. 10'), { target: { value: '25' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. pages'), { target: { value: 'pages' } });

    store.categories = [{ id: 'category-1', name: 'Learning', color: 'bg-blue-500' }];
    rerender(<AddHabitModal isOpen onClose={() => {}} />);

    expect(screen.getByPlaceholderText('e.g., Morning Jog')).toHaveValue('Read books');
    expect(screen.getByPlaceholderText('e.g. 10')).toHaveValue(25);
    expect(screen.getByPlaceholderText('e.g. pages')).toHaveValue('pages');
  });

  it('keeps create disabled until a numeric target and category are valid', () => {
    store.categories = [{ id: 'category-1', name: 'Learning', color: 'bg-blue-500' }];
    render(<AddHabitModal isOpen onClose={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText('e.g., Morning Jog'), {
      target: { value: 'Read books' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Numeric' }));

    expect(screen.getByRole('button', { name: 'Create Habit' })).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('e.g. 10'), { target: { value: '10' } });
    expect(screen.getByRole('button', { name: 'Create Habit' })).toBeEnabled();
  });
});
