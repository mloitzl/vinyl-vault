import { useLazyLoadQuery, graphql } from 'react-relay';
import type { useGenresQuery as UseGenresQueryType } from '../../__generated__/useGenresQuery.graphql';

export const GenresQuery = graphql`
  query useGenresQuery {
    genres {
      name
      recordCount
    }
  }
`;

export function useGenresQuery() {
  const data = useLazyLoadQuery<UseGenresQueryType>(GenresQuery, {}, { fetchPolicy: 'network-only' });
  return data.genres;
}
