import { useQueryLoader } from 'react-relay';
import { AlbumsQuery } from './useAlbumsQuery';
import type { useAlbumsQuery as AlbumsQueryType } from '../../__generated__/useAlbumsQuery.graphql';

interface AlbumsQueryVariables {
  first?: number;
  after?: string;
  filter?: { search?: string; artist?: string };
}

export function useAlbumsQueryLoader() {
  const [queryRef, loadQuery] = useQueryLoader<AlbumsQueryType>(AlbumsQuery);

  const refetch = (variables: AlbumsQueryVariables = {}) => {
    loadQuery(variables, { fetchPolicy: 'network-only' });
  };

  return { queryRef, loadQuery, refetch };
}
