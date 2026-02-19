import { useLazyLoadQuery, graphql, usePreloadedQuery } from 'react-relay';
import type { useRecordsQuery as UseRecordsQueryType } from '../../__generated__/useRecordsQuery.graphql';

interface RecordFilter {
  artist?: string;
  title?: string;
  year?: number;
  format?: string;
  location?: string;
  search?: string;
}

interface RecordsQueryVariables {
  first?: number;
  after?: string;
  last?: number;
  before?: string;
  filter?: RecordFilter;
}

export const RecordsQuery = graphql`
  query useRecordsQuery($first: Int, $after: String, $filter: RecordFilter) {
    records(first: $first, after: $after, filter: $filter) {
      edges {
        node {
          id
          purchaseDate
          price
          condition
          location
          notes
          createdAt
          updatedAt
          owner {
            id
            githubLogin
            displayName
            avatarUrl
          }
          release {
            id
            barcode
            artist
            title
            year
            format
            label
            country
            coverImageUrl
            externalId
            source
            genre
            style
            trackList {
              position
              title
              duration
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;

/**
 * Hook to fetch paginated records with filtering.
 * @param variables Query variables for pagination and filtering
 * @returns Records connection with pagination and records
 */
export function useRecordsQuery(variables: RecordsQueryVariables = {}) {
  const data = useLazyLoadQuery<UseRecordsQueryType>(RecordsQuery, variables);
  return data.records;
}

/**
 * Hook to use preloaded records query (for use with useQueryLoader).
 * @param queryRef Preloaded query reference
 * @returns Records connection with pagination and records
 */
export function useRecordsQueryPreloaded(queryRef: any) {
  const data = usePreloadedQuery<UseRecordsQueryType>(RecordsQuery, queryRef);
  return data.records;
}
