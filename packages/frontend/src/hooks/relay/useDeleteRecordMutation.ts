import { useMutation, graphql } from 'react-relay';
import type { useDeleteRecordMutation as UseDeleteRecordMutationType } from '../../__generated__/useDeleteRecordMutation.graphql';

interface DeleteRecordInput {
  id: string;
}

type RefetchFn = (variables: Record<string, any>) => void;

const DeleteRecordMutation = graphql`
  mutation useDeleteRecordMutation($input: DeleteRecordInput!) {
    deleteRecord(input: $input) {
      deletedRecordId
      errors
    }
  }
`;

/**
 * Hook to delete a record from the collection.
 * @returns Mutation function and loading state
 */
export function useDeleteRecordMutation() {
  const [commit, isInFlight] = useMutation<UseDeleteRecordMutationType>(DeleteRecordMutation);

  const mutate = async (input: DeleteRecordInput, refetch?: RefetchFn) => {
    return new Promise((resolve, reject) => {
      commit({
        variables: { input },
        onCompleted: (response) => {
          if (response.deleteRecord.errors && response.deleteRecord.errors.length > 0) {
            reject(new Error(response.deleteRecord.errors[0]));
          } else {
            // Refetch records list after deletion
            refetch?.({ first: 20 });
            resolve(response.deleteRecord.deletedRecordId);
          }
        },
        onError: reject,
      });
    });
  };

  return { mutate, isLoading: isInFlight };
}
