import { useMutation, graphql } from 'react-relay';

const SendFriendRequestMutation = graphql`
  mutation useSendFriendRequestMutation($githubLogin: String!) {
    sendFriendRequest(githubLogin: $githubLogin)
  }
`;

export function useSendFriendRequestMutation() {
  const [commit, isInFlight] = useMutation(SendFriendRequestMutation);

  const mutate = (githubLogin: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      commit({
        variables: { githubLogin },
        onCompleted: () => resolve(),
        onError: reject,
      });
    });
  };

  return { mutate, isLoading: isInFlight };
}
