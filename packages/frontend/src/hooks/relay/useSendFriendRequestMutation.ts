import { useMutation, graphql } from 'react-relay';
import type { useSendFriendRequestMutation as UseSendFriendRequestMutationType } from '../../__generated__/useSendFriendRequestMutation.graphql';

const SendFriendRequestMutation = graphql`
  mutation useSendFriendRequestMutation($githubLogin: String!) {
    sendFriendRequest(githubLogin: $githubLogin)
  }
`;

export function useSendFriendRequestMutation() {
  const [commit, isInFlight] = useMutation<UseSendFriendRequestMutationType>(SendFriendRequestMutation);

  const mutate = (githubLogin: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      commit({
        variables: { githubLogin },
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
