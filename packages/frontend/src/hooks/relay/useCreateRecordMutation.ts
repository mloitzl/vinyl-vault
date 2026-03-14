import { useMutation, graphql } from 'react-relay';
import { ConnectionHandler, ROOT_ID } from 'relay-runtime';
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
  mutation useCreateRecordMutation($input: CreateRecordInput!, $connections: [ID!]!) {
    createRecord(input: $input) {
      record @appendNode(connections: $connections, edgeTypeName: "RecordEdge") {
        id
        purchaseDate
        price
        condition
        location
        notes
        createdAt
        updatedAt
        owner {
          id
          githubLogin
          displayName
          avatarUrl
        }
        release {
          id
          barcode
          artist
          title
          year
          format
          label
          country
          coverImageUrl
          externalId
          source
          genre
          style
          trackList {
            position
            title
            duration
          }
        }
      }
      errors
    }
  }
`;

export function useCreateRecordMutation() {
  const [commit, isInFlight] = useMutation<UseCreateRecordMutationType>(CreateRecordMutation);

  const mutate = async (input: CreateRecordInput) => {
    // Append to the unfiltered connection so the new record appears in the
    // default collection view without a refetch.
    const connectionId = ConnectionHandler.getConnectionID(ROOT_ID, 'RecordList_records');

    return new Promise((resolve, reject) => {
      commit({
        variables: { input, connections: [connectionId] },
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
