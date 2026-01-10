import { graphql } from 'babel-plugin-relay/macro';
import { useLazyLoadQuery } from 'react-relay';
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

const RecordsQuery = graphql`
  query useRecordsQuery(
    $first: Int
    $after: String
    $last: Int
    $before: String
    $filter: RecordFilter
  ) {
    records(first: $first, after: $after, last: $last, before: $before, filter: $filter) {
      edges {
        cursor
        node {
          id
          purchaseDate
          price
          condition
          location
          notes
          createdAt
          updatedAt
          release {
            id
            barcode
            artist
            title
            year
            format
            genre
            style
            label
            country
            coverImageUrl
            externalId
            source
            trackList {
              position
              title
              duration
            }
          }
          owner {
            id
            githubLogin
            displayName
            avatarUrl
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
