import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface LoadingContextType {
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  incrementLoading: () => void;
  decrementLoading: () => void;
}

const LoadingContext = createContext<LoadingContextType | null>(null);

interface LoadingProviderProps {
  children: ReactNode;
}

/**
 * LoadingProvider manages a global loading counter
 * Allows multiple async operations to be tracked simultaneously
 * Useful for showing/hiding global loading indicators
 */
export function LoadingProvider({ children }: LoadingProviderProps) {
  const [loadingCount, setLoadingCount] = useState(0);

  const setIsLoading = useCallback((loading: boolean) => {
    setLoadingCount(loading ? 1 : 0);
  }, []);

  const incrementLoading = useCallback(() => {
    setLoadingCount((prev) => prev + 1);
  }, []);

  const decrementLoading = useCallback(() => {
    setLoadingCount((prev) => Math.max(0, prev - 1));
  }, []);

  const value: LoadingContextType = {
    isLoading: loadingCount > 0,
    setIsLoading,
    incrementLoading,
    decrementLoading,
  };

  return <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>;
}

export function useLoading(): LoadingContextType {
  const context = useContext(LoadingContext);

  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }

  return context;
}
