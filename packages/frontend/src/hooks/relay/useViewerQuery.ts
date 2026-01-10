import { useLazyLoadQuery } from 'react-relay';
import type { useViewerQuery as UseViewerQueryType } from '../../__generated__/useViewerQuery.graphql';
import ViewerQueryArtifact from '../../__generated__/useViewerQuery.graphql';

const ViewerQuery = ViewerQueryArtifact;

/**
 * Hook to fetch the current authenticated viewer with tenant context.
 * @returns Current user with available tenants and active tenant
 */
export function useViewerQuery() {
  const data = useLazyLoadQuery<UseViewerQueryType>(ViewerQuery, {});
  return data.viewer;
}
