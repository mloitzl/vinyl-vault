import { useMutation, graphql, ConnectionHandler } from 'react-relay';
import { ROOT_ID } from 'relay-runtime';
import type { useRespondToFriendRequestMutation as UseRespondToFriendRequestMutationType } from '../../__generated__/useRespondToFriendRequestMutation.graphql';

const RespondToFriendRequestMutation = graphql`
  mutation useRespondToFriendRequestMutation(
    $requestId: ID!, $accept: Boolean!,
    $pendingConnections: [ID!]!, $friendConnections: [ID!]!
  ) {
    respondToFriendRequest(requestId: $requestId, accept: $accept) {
      deletedRequestId @deleteEdge(connections: $pendingConnections)
      newFriend @appendNode(connections: $friendConnections, edgeTypeName: "UserEdge") {
        id
        githubLogin
        displayName
        avatarUrl
      }
      notificationCount
    }
  }
`;

export function useRespondToFriendRequestMutation() {
  const [commit, isInFlight] = useMutation<UseRespondToFriendRequestMutationType>(RespondToFriendRequestMutation);

  const mutate = (requestId: string, accept: boolean): Promise<void> => {
    const pendingConnectionId = ConnectionHandler.getConnectionID(ROOT_ID, 'SocialPage_pendingFriendRequests');
    const friendConnectionId = ConnectionHandler.getConnectionID(ROOT_ID, 'SocialPage_friends');
    return new Promise((resolve, reject) => {
      commit({
        variables: {
          requestId,
          accept,
          pendingConnections: [pendingConnectionId],
          friendConnections: accept ? [friendConnectionId] : [],
        },
        updater: (store) => {
          const payload = store.getRootField('respondToFriendRequest');
          const newCount = payload?.getValue('notificationCount');
          if (newCount !== null && newCount !== undefined) {
            store.getRoot().setValue(newCount, 'notificationCount');
          }
        },
        onCompleted: (_response, errors) => {
          if (errors && errors.length > 0) {
            reject(new Error(errors.map((e) => e.message).join(', ')));
            return;
          }
          window.dispatchEvent(new CustomEvent('vinyl-vault:notifications-changed'));
          resolve();
        },
        onError: reject,
      });
    });
  };

  return { mutate, isLoading: isInFlight };
}
