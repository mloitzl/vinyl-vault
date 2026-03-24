import { graphql, usePreloadedQuery, useQueryLoader, useFragment } from 'react-relay';
import type { PreloadedQuery } from 'react-relay';
import type { useSocialQuery as SocialQueryType } from '../../__generated__/useSocialQuery.graphql';
import type { useSocialQueryData$key } from '../../__generated__/useSocialQueryData.graphql';

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

export function useSocialQueryLoader() {
  const [queryRef, loadQuery] = useQueryLoader<SocialQueryType>(SocialQuery);

  const load = () => {
    loadQuery({}, { fetchPolicy: 'store-or-network' });
  };

  return { queryRef, load };
}

export function useSocialQueryPreloaded(queryRef: PreloadedQuery<SocialQueryType>) {
  return usePreloadedQuery(SocialQuery, queryRef);
}

export function useSocialQueryData(fragmentRef: useSocialQueryData$key) {
  return useFragment(SocialDataFragment, fragmentRef);
}
