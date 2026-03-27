import { graphql, useLazyLoadQuery, useFragment } from 'react-relay';
import type { useSocialQuery as SocialQueryType } from '../../__generated__/useSocialQuery.graphql';
import type { useSocialQueryData$data, useSocialQueryData$key } from '../../__generated__/useSocialQueryData.graphql';

export const SocialDataFragment = graphql`
  fragment useSocialQueryData on Query {
    pendingFriendRequests(first: 50) @connection(key: "SocialPage_pendingFriendRequests") {
      edges {
        node {
          id
          createdAt
          requester {
            id
            githubLogin
            displayName
            avatarUrl
          }
        }
      }
    }
    sentFriendRequests(first: 50) @connection(key: "SocialPage_sentFriendRequests") {
      edges {
        node {
          id
          createdAt
          recipient {
            id
            githubLogin
            displayName
            avatarUrl
          }
        }
      }
    }
    friends(first: 100) @connection(key: "SocialPage_friends") {
      edges {
        node {
          id
          githubLogin
          displayName
          avatarUrl
        }
      }
    }
    notificationCount
  }
`;

export const SocialQuery = graphql`
  query useSocialQuery {
    ...useSocialQueryData
  }
`;

/**
 * Fetches social data inside a Suspense boundary.
 *
 * fetchPolicy 'store-and-network':
 *   - Shows any cached data immediately (no spinner on re-visits)
 *   - Always fires a background network fetch to update stale data
 *   - fetchKey increment forces a new network fetch (used for
 *     notification-triggered refreshes) without suspending
 */
export function useSocialData(fetchKey: number): useSocialQueryData$data {
  const rootData = useLazyLoadQuery<SocialQueryType>(
    SocialQuery,
    {},
    { fetchPolicy: 'store-and-network', fetchKey },
  );
  return useFragment<useSocialQueryData$key>(SocialDataFragment, rootData);
}
