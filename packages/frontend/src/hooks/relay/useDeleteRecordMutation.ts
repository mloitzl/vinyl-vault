import { useMutation, graphql } from 'react-relay';
import type { useDeleteRecordMutation as UseDeleteRecordMutationType } from '../../__generated__/useDeleteRecordMutation.graphql';

interface DeleteRecordInput {
  id: string;
}

const DeleteRecordMutation = graphql`
  mutation useDeleteRecordMutation($input: DeleteRecordInput!, $connections: [ID!]!) {
    deleteRecord(input: $input) {
      deletedRecordId @deleteEdge(connections: $connections)
      errors
    }
  }
`;

export function useDeleteRecordMutation() {
  const [commit, isInFlight] = useMutation<UseDeleteRecordMutationType>(DeleteRecordMutation);

  const mutate = async (input: DeleteRecordInput, connections: string[]) => {
    return new Promise((resolve, reject) => {
      commit({
        variables: { input, connections },
        onCompleted: (response) => {
          if (response.deleteRecord.errors && response.deleteRecord.errors.length > 0) {
            reject(new Error(response.deleteRecord.errors[0]));
          } else {
            resolve(response.deleteRecord.deletedRecordId);
          }
        },
        onError: reject,
      });
    });
  };

  return { mutate, isLoading: isInFlight };
}
