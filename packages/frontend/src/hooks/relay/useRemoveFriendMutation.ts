import { useMutation, graphql, ConnectionHandler } from 'react-relay';
import { ROOT_ID } from 'relay-runtime';
import type { useRemoveFriendMutation as UseRemoveFriendMutationType } from '../../__generated__/useRemoveFriendMutation.graphql';

const RemoveFriendMutation = graphql`
  mutation useRemoveFriendMutation($friendId: ID!, $connections: [ID!]!) {
    removeFriend(friendId: $friendId) {
      removedFriendId @deleteEdge(connections: $connections)
    }
  }
`;

export function useRemoveFriendMutation() {
  const [commit, isInFlight] = useMutation<UseRemoveFriendMutationType>(RemoveFriendMutation);

  const mutate = (friendId: string): Promise<void> => {
    const connectionId = ConnectionHandler.getConnectionID(ROOT_ID, 'SocialPage_friends');
    return new Promise((resolve, reject) => {
      commit({
        variables: { friendId, connections: [connectionId] },
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
