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


const UpdateRecordMutation = graphql`
  mutation useUpdateRecordMutation($input: UpdateRecordInput!) {
    updateRecord(input: $input) {
      record {
        id
        condition
        location
        price
        purchaseDate
        notes
      }
      errors
    }
  }
`;

export function useUpdateRecordMutation() {
  const [commit, isInFlight] = useMutation<UseUpdateRecordMutationType>(UpdateRecordMutation);

  const mutate = async (input: UpdateRecordInput) => {
    return new Promise((resolve, reject) => {
      commit({
        variables: { input },
        onCompleted: (response) => {
          if (response.updateRecord.errors && response.updateRecord.errors.length > 0) {
            reject(new Error(response.updateRecord.errors[0]));
          } else {
            // Relay automatically merges updated fields into the store by id
            resolve(response.updateRecord.record);
          }
        },
        onError: reject,
      });
    });
  };

  return { mutate, isLoading: isInFlight };
}
