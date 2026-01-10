import { useMutation, graphql } from 'react-relay';
import type { useCreateRecordMutation as UseCreateRecordMutationType } from '../../__generated__/useCreateRecordMutation.graphql';

interface CreateRecordInput {
  releaseId: string;
  purchaseDate?: string;
  price?: number;
  condition?: string;
  location?: string;
  notes?: string;
}

const CreateRecordMutation = graphql`
  mutation useCreateRecordMutation($input: CreateRecordInput!) {
    createRecord(input: $input) {
      record {
        id
      }
      errors
    }
  }
`;

/**
 * Hook to create a new record in the collection.
 * @returns Mutation function and loading state
 */
export function useCreateRecordMutation() {
  const [commit, isInFlight] = useMutation<UseCreateRecordMutationType>(CreateRecordMutation);

  const mutate = async (input: CreateRecordInput) => {
    return new Promise((resolve, reject) => {
      commit({
        variables: { input },
        onCompleted: (response) => {
          if (response.createRecord.errors && response.createRecord.errors.length > 0) {
            reject(new Error(response.createRecord.errors[0]));
          } else {
            resolve(response.createRecord.record);
          }
        },
        onError: reject,
      });
    });
  };

  return { mutate, isLoading: isInFlight };
}
