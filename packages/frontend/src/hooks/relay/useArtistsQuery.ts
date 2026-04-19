import { useLazyLoadQuery, graphql, usePreloadedQuery } from 'react-relay';
import type { useArtistsQuery as UseArtistsQueryType } from '../../__generated__/useArtistsQuery.graphql';

export const ArtistsQuery = graphql`
  query useArtistsQuery($first: Int, $after: String, $filter: ArtistFilter) {
    artists(first: $first, after: $after, filter: $filter) {
      edges {
        node {
          id
          name
          recordCount
          coverImageUrl
          artistThumbnailUrls
          genres
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`;

export function useArtistsQuery(variables: {
  first?: number;
  after?: string;
  filter?: { search?: string };
} = {}) {
  const data = useLazyLoadQuery<UseArtistsQueryType>(ArtistsQuery, variables);
  return data.artists;
}

export function useArtistsQueryPreloaded(queryRef: any) {
  const data = usePreloadedQuery<UseArtistsQueryType>(ArtistsQuery, queryRef);
  return data.artists;
}
