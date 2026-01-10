/**
 * Unit tests for LoadingContext and useLoading hook
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { LoadingProvider, useLoading } from './LoadingContext';
import type { ReactNode } from 'react';

describe('LoadingContext', () => {
  it('should provide initial loading state as false', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <LoadingProvider>{children}</LoadingProvider>
    );

    const { result } = renderHook(() => useLoading(), { wrapper });

    expect(result.current.isLoading).toBe(false);
  });

  it('should set loading state with setIsLoading', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <LoadingProvider>{children}</LoadingProvider>
    );

    const { result } = renderHook(() => useLoading(), { wrapper });

    act(() => {
      result.current.setIsLoading(true);
    });

    expect(result.current.isLoading).toBe(true);

    act(() => {
      result.current.setIsLoading(false);
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('should increment loading count', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <LoadingProvider>{children}</LoadingProvider>
    );

    const { result } = renderHook(() => useLoading(), { wrapper });

    expect(result.current.isLoading).toBe(false);

    act(() => {
      result.current.incrementLoading();
    });

    expect(result.current.isLoading).toBe(true);

    act(() => {
      result.current.incrementLoading();
    });

    // Still true (count > 0)
    expect(result.current.isLoading).toBe(true);
  });

  it('should decrement loading count', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <LoadingProvider>{children}</LoadingProvider>
    );

    const { result } = renderHook(() => useLoading(), { wrapper });

    act(() => {
      result.current.incrementLoading();
      result.current.incrementLoading();
    });

    expect(result.current.isLoading).toBe(true);

    act(() => {
      result.current.decrementLoading();
    });

    expect(result.current.isLoading).toBe(true);

    act(() => {
      result.current.decrementLoading();
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('should not go below zero when decrementing', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <LoadingProvider>{children}</LoadingProvider>
    );

    const { result } = renderHook(() => useLoading(), { wrapper });

    act(() => {
      result.current.decrementLoading();
      result.current.decrementLoading();
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('should handle multiple async operations', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <LoadingProvider>{children}</LoadingProvider>
    );

    const { result } = renderHook(() => useLoading(), { wrapper });

    // Start 3 async operations
    act(() => {
      result.current.incrementLoading();
      result.current.incrementLoading();
      result.current.incrementLoading();
    });

    expect(result.current.isLoading).toBe(true);

    // Complete 1 operation
    act(() => {
      result.current.decrementLoading();
    });

    expect(result.current.isLoading).toBe(true);

    // Complete 2 operations
    act(() => {
      result.current.decrementLoading();
      result.current.decrementLoading();
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('should throw error when useLoading is used outside provider', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useLoading());
    }).toThrow('useLoading must be used within a LoadingProvider');

    consoleErrorSpy.mockRestore();
  });
});
