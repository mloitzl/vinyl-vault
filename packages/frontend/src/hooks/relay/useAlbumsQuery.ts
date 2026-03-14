import { useLazyLoadQuery, graphql, usePreloadedQuery } from 'react-relay';
import type { useAlbumsQuery as UseAlbumsQueryType } from '../../__generated__/useAlbumsQuery.graphql';

export const AlbumsQuery = graphql`
  query useAlbumsQuery($first: Int, $after: String, $filter: AlbumBrowseFilter) {
    albums(first: $first, after: $after, filter: $filter) {
      edges {
        node {
          id
          title
          artist
          year
          coverImageUrl
          format
          recordCount
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

export function useAlbumsQuery(variables: {
  first?: number;
  after?: string;
  filter?: { search?: string; artist?: string };
} = {}) {
  const data = useLazyLoadQuery<UseAlbumsQueryType>(AlbumsQuery, variables);
  return data.albums;
}

export function useAlbumsQueryPreloaded(queryRef: any) {
  const data = usePreloadedQuery<UseAlbumsQueryType>(AlbumsQuery, queryRef);
  return data.albums;
}
