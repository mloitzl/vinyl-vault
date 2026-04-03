import { graphql, useLazyLoadQuery } from 'react-relay';
import type { useSearchRecordsQuery as UseSearchRecordsQueryType } from '../../__generated__/useSearchRecordsQuery.graphql';

export interface RecordSearchFilter {
  genre?: string[];
  format?: string[];
  condition?: string[];
  location?: string[];
  country?: string[];
}

const SearchRecordsQuery = graphql`
  query useSearchRecordsQuery(
    $query: String!
    $first: Int
    $after: String
    $filter: RecordSearchFilter
  ) {
    searchRecords(query: $query, first: $first, after: $after, filter: $filter) {
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
        endCursor
      }
      totalCount
      facets {
        genre     { value count }
        format    { value count }
        condition { value count }
        location  { value count }
        country   { value count }
      }
    }
  }
`;

export function useSearchRecordsQuery(variables: {
  query: string;
  first?: number;
  after?: string;
  filter?: RecordSearchFilter;
}) {
  return useLazyLoadQuery<UseSearchRecordsQueryType>(SearchRecordsQuery, variables);
}
