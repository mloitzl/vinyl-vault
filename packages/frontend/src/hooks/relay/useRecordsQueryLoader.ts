import { useQueryLoader } from 'react-relay';
import { RecordsQuery } from './useRecordsQuery';
import type { useRecordsQuery as RecordsQueryType } from '../../__generated__/useRecordsQuery.graphql';

interface RecordsQueryVariables {
  first?: number;
  after?: string;
  filter?: {
    artist?: string;
    title?: string;
    year?: number;
    format?: string;
    location?: string;
    search?: string;
  };
}

export function useRecordsQueryLoader() {
  const [queryRef, loadQuery] = useQueryLoader<RecordsQueryType>(RecordsQuery);

  const refetch = (variables: RecordsQueryVariables = {}) => {
    loadQuery(variables, { fetchPolicy: 'network-only' });
  };

  return { queryRef, loadQuery, refetch };
}
