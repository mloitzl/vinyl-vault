import { useMutation, graphql } from 'react-relay';

const RemoveFriendMutation = graphql`
  mutation useRemoveFriendMutation($friendId: ID!) {
    removeFriend(friendId: $friendId)
  }
`;

export function useRemoveFriendMutation() {
  const [commit, isInFlight] = useMutation(RemoveFriendMutation);

  const mutate = (friendId: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      commit({
        variables: { friendId },
        onCompleted: () => resolve(),
        onError: reject,
      });
    });
  };

  return { mutate, isLoading: isInFlight };
}
