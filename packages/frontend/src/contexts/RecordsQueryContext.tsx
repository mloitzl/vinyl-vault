import { createContext, useContext, ReactNode } from 'react';

interface RecordsQueryContextType {
  refetch: (variables: Record<string, any>) => void;
}

const RecordsQueryContext = createContext<RecordsQueryContextType | null>(null);

export function useRecordsQueryContext() {
  const context = useContext(RecordsQueryContext);
  if (!context) {
    throw new Error('useRecordsQueryContext must be used within RecordsQueryProvider');
  }
  return context;
}

export function RecordsQueryProvider({ children }: { children: ReactNode }) {
  // Provider will be empty; mutations will inject refetch through context
  // This is a placeholder to avoid errors; actual implementation happens in CollectionPage
  return (
    <RecordsQueryContext.Provider value={{ refetch: () => {} }}>
      {children}
    </RecordsQueryContext.Provider>
  );
}
