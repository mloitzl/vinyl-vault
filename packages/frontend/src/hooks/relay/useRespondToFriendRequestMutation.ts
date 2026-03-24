import { useMutation, graphql } from 'react-relay';
import type { useRespondToFriendRequestMutation as UseRespondToFriendRequestMutationType } from '../../__generated__/useRespondToFriendRequestMutation.graphql';

const RespondToFriendRequestMutation = graphql`
  mutation useRespondToFriendRequestMutation($requestId: ID!, $accept: Boolean!) {
    respondToFriendRequest(requestId: $requestId, accept: $accept)
  }
`;

export function useRespondToFriendRequestMutation() {
  const [commit, isInFlight] = useMutation<UseRespondToFriendRequestMutationType>(RespondToFriendRequestMutation);

  const mutate = (requestId: string, accept: boolean): Promise<void> => {
    return new Promise((resolve, reject) => {
      commit({
        variables: { requestId, accept },
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
