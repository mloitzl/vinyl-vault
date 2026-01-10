// @ts-nocheck
import { ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { RelayEnvironmentProvider } from 'react-relay';
import { RelayEnvironment } from '../relay/environment';
import { AuthProvider } from '../contexts/AuthContext';
import { ToastProvider } from '../contexts/ToastContext';
import { LoadingProvider } from '../contexts/LoadingContext';

/**
 * Wrapper component that provides all necessary context providers
 * Use this with render() when testing components that need providers
 */
function AllProviders({ children }: { children: ReactNode }) {
  return (
    <RelayEnvironmentProvider environment={RelayEnvironment}>
      <ToastProvider>
        <LoadingProvider>
          <AuthProvider>{children}</AuthProvider>
        </LoadingProvider>
      </ToastProvider>
    </RelayEnvironmentProvider>
  );
}

/**
 * Custom render function that automatically wraps components with all providers
 */
const customRender: typeof render = (ui: any, options?: any) =>
  render(ui, { wrapper: AllProviders, ...(options as any) });

export * from '@testing-library/react';
export { customRender as render };
