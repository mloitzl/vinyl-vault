import { useLazyLoadQuery } from 'react-relay';
import type { useRecordsQuery as UseRecordsQueryType } from '../../__generated__/useRecordsQuery.graphql';
import RecordsQueryArtifact from '../../__generated__/useRecordsQuery.graphql';

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

const RecordsQuery = RecordsQueryArtifact;

/**
 * Hook to fetch paginated records with filtering.
 * @param variables Query variables for pagination and filtering
 * @returns Records connection with pagination and records
 */
export function useRecordsQuery(variables: RecordsQueryVariables = {}) {
  const data = useLazyLoadQuery<UseRecordsQueryType>(RecordsQuery, variables);
  return data.records;
}
