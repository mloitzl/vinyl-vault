import { useMutation, graphql, ConnectionHandler } from 'react-relay';
import { ROOT_ID } from 'relay-runtime';
import type { useSendFriendRequestMutation as UseSendFriendRequestMutationType } from '../../__generated__/useSendFriendRequestMutation.graphql';

const SendFriendRequestMutation = graphql`
  mutation useSendFriendRequestMutation($githubLogin: String!, $connections: [ID!]!) {
    sendFriendRequest(githubLogin: $githubLogin) {
      friendRequest @appendNode(connections: $connections, edgeTypeName: "FriendRequestEdge") {
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
`;

export function useSendFriendRequestMutation() {
  const [commit, isInFlight] = useMutation<UseSendFriendRequestMutationType>(SendFriendRequestMutation);

  const mutate = (githubLogin: string): Promise<void> => {
    const connectionId = ConnectionHandler.getConnectionID(ROOT_ID, 'SocialPage_sentFriendRequests');
    return new Promise((resolve, reject) => {
      commit({
        variables: { githubLogin, connections: [connectionId] },
        onCompleted: (_response, errors) => {
          if (errors && errors.length > 0) {
            reject(new Error(errors.map((e) => e.message).join(', ')));
            return;
          }
          resolve();
        },
        onError: reject,
      });
    });
  };

  return { mutate, isLoading: isInFlight };
}
