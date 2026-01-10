import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HomePage } from '../pages/HomePage';

// Mock the AuthContext
vi.mock('../contexts/AuthContext', async () => {
  const actual = await vi.importActual('../contexts/AuthContext');
  return {
    ...actual,
    useAuth: () => ({
      user: null,
      isLoading: false,
      error: null,
      refreshUser: vi.fn(),
      activeTenant: null,
    }),
  };
});

describe('HomePage', () => {
  it('renders welcome message when not authenticated', () => {
    render(
      <MemoryRouter>
        <HomePage recordCount={0} artistCount={0} />
      </MemoryRouter>
    );

    expect(screen.getByText('Welcome to Vinyl Vault')).toBeInTheDocument();
    expect(screen.getByText(/Sign in with GitHub to get started/i)).toBeInTheDocument();
  });
});
