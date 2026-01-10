import { useMutation, graphql } from 'react-relay';
import type { useUpdateRecordMutation as UseUpdateRecordMutationType } from '../../__generated__/useUpdateRecordMutation.graphql';

interface UpdateRecordInput {
  id: string;
  purchaseDate?: string;
  price?: number;
  condition?: string;
  location?: string;
  notes?: string;
}

type RefetchFn = (variables: Record<string, any>) => void;

const UpdateRecordMutation = graphql`
  mutation useUpdateRecordMutation($input: UpdateRecordInput!) {
    updateRecord(input: $input) {
      record {
        id
      }
      errors
    }
  }
`;

/**
 * Hook to update an existing record.
 * @returns Mutation function and loading state
 */
export function useUpdateRecordMutation() {
  const [commit, isInFlight] = useMutation<UseUpdateRecordMutationType>(UpdateRecordMutation);

  const mutate = async (input: UpdateRecordInput, refetch?: RefetchFn) => {
    return new Promise((resolve, reject) => {
      commit({
        variables: { input },
        onCompleted: (response) => {
          if (response.updateRecord.errors && response.updateRecord.errors.length > 0) {
            reject(new Error(response.updateRecord.errors[0]));
          } else {
            // Refetch records list after update
            refetch?.({ first: 20 });
            resolve(response.updateRecord.record);
          }
        },
        onError: reject,
      });
    });
  };

  return { mutate, isLoading: isInFlight };
}
