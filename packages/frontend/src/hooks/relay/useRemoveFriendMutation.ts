import { useMutation, graphql } from 'react-relay';
import type { useRemoveFriendMutation as UseRemoveFriendMutationType } from '../../__generated__/useRemoveFriendMutation.graphql';

const RemoveFriendMutation = graphql`
  mutation useRemoveFriendMutation($friendId: ID!) {
    removeFriend(friendId: $friendId)
  }
`;

export function useRemoveFriendMutation() {
  const [commit, isInFlight] = useMutation<UseRemoveFriendMutationType>(RemoveFriendMutation);

  const mutate = (friendId: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      commit({
        variables: { friendId },
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
