import { useLazyLoadQuery, usePreloadedQuery, usePaginationFragment, graphql } from 'react-relay';
import type { useRecordsQuery as UseRecordsQueryType } from '../../__generated__/useRecordsQuery.graphql';

interface RecordFilter {
  artist?: string;
  title?: string;
  year?: number;
  format?: string;
  genre?: string;
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

// Fragment that owns the @connection — used with usePaginationFragment for
// proper load-more (appending) and @deleteEdge support in mutations.
export const RecordListFragment = graphql`
  fragment useRecordsQuery_records on Query
    @refetchable(queryName: "useRecordsQueryPaginationQuery")
    @argumentDefinitions(
      first:  { type: "Int",          defaultValue: 20 }
      after:  { type: "String" }
      filter: { type: "RecordFilter" }
    ) {
    records(first: $first, after: $after, filter: $filter)
      @connection(key: "RecordList_records") {
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

export const RecordsQuery = graphql`
  query useRecordsQuery($first: Int, $after: String, $filter: RecordFilter) {
    ...useRecordsQuery_records @arguments(first: $first, after: $after, filter: $filter)
  }
`;

export function useRecordsQuery(variables: RecordsQueryVariables = {}) {
  const data = useLazyLoadQuery<UseRecordsQueryType>(RecordsQuery, variables);
  return data;
}

export function useRecordsQueryPreloaded(queryRef: any) {
  const data = usePreloadedQuery<UseRecordsQueryType>(RecordsQuery, queryRef);
  return data;
}

export function useRecordListPagination(fragmentRef: any) {
  return usePaginationFragment(RecordListFragment, fragmentRef);
}
