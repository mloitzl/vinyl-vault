import { useMutation, graphql } from 'react-relay';

const RespondToFriendRequestMutation = graphql`
  mutation useRespondToFriendRequestMutation($requestId: ID!, $accept: Boolean!) {
    respondToFriendRequest(requestId: $requestId, accept: $accept)
  }
`;

export function useRespondToFriendRequestMutation() {
  const [commit, isInFlight] = useMutation(RespondToFriendRequestMutation);

  const mutate = (requestId: string, accept: boolean): Promise<void> => {
    return new Promise((resolve, reject) => {
      commit({
        variables: { requestId, accept },
        onCompleted: () => resolve(),
        onError: reject,
      });
    });
  };

  return { mutate, isLoading: isInFlight };
}
