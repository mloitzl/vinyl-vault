import { useQueryLoader } from 'react-relay';
import { ArtistsQuery } from './useArtistsQuery';
import type { useArtistsQuery as ArtistsQueryType } from '../../__generated__/useArtistsQuery.graphql';

interface ArtistsQueryVariables {
  first?: number;
  after?: string;
  filter?: { search?: string };
}

export function useArtistsQueryLoader() {
  const [queryRef, loadQuery] = useQueryLoader<ArtistsQueryType>(ArtistsQuery);

  const refetch = (variables: ArtistsQueryVariables = {}) => {
    loadQuery(variables, { fetchPolicy: 'network-only' });
  };

  return { queryRef, loadQuery, refetch };
}
