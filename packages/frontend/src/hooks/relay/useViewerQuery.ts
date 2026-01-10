import { graphql } from 'babel-plugin-relay/macro';
import { useLazyLoadQuery } from 'react-relay';
import type { useViewerQuery as UseViewerQueryType } from '../../__generated__/useViewerQuery.graphql';

const ViewerQuery = graphql`
  query useViewerQuery {
    viewer {
      id
      githubLogin
      displayName
      avatarUrl
      availableTenants {
        id
        name
        type
        role
      }
      activeTenant {
        id
        name
        type
        role
      }
      createdAt
      updatedAt
    }
  }
`;

/**
 * Hook to fetch the current authenticated viewer with tenant context.
 * @returns Current user with available tenants and active tenant
 */
export function useViewerQuery() {
  const data = useLazyLoadQuery<UseViewerQueryType>(ViewerQuery, {});
  return data.viewer;
}
