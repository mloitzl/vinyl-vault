import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { NotFoundPage } from '../pages/NotFoundPage';
import { HomePage } from '../pages/HomePage';
import { ScanPage } from '../pages/ScanPage';
import { SearchPage } from '../pages/SearchPage';

// Mock user for authenticated tests
const mockUser = {
  id: '1',
  githubLogin: 'testuser',
  displayName: 'Test User',
  avatarUrl: 'https://example.com/avatar.jpg',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// Mock the AuthContext with authenticated user
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    isLoading: false,
    error: null,
    refreshUser: vi.fn(),
    activeTenant: null,
  }),
}));

// Mock ScanBarcode component to avoid ZXing errors in tests
vi.mock('../components/ScanBarcode', () => ({
  ScanBarcode: () => <div data-testid="scan-barcode-component">Scan Barcode Component</div>,
}));

describe('Routing', () => {
  it('renders HomePage for root path', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<HomePage recordCount={5} artistCount={3} />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/Hi, Test/i)).toBeInTheDocument();
  });

  it('renders ScanPage for /scan path', () => {
    render(
      <MemoryRouter initialEntries={['/scan']}>
        <Routes>
          <Route path="/scan" element={<ScanPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('scan-barcode-component')).toBeInTheDocument();
  });

  it('renders SearchPage for /search path', () => {
    render(
      <MemoryRouter initialEntries={['/search']}>
        <Routes>
          <Route path="/search" element={<SearchPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByPlaceholderText(/search by artist/i)).toBeInTheDocument();
  });

  it('renders NotFoundPage for unknown paths', () => {
    render(
      <MemoryRouter initialEntries={['/unknown-route']}>
        <Routes>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText('Page Not Found')).toBeInTheDocument();
  });
});
