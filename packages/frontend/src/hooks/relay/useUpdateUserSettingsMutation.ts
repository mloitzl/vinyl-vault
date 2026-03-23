import { useMutation, graphql } from 'react-relay';
import type { useUpdateUserSettingsMutation as UseUpdateUserSettingsMutationType } from '../../__generated__/useUpdateUserSettingsMutation.graphql';

const UpdateUserSettingsMutation = graphql`
  mutation useUpdateUserSettingsMutation($input: UpdateUserSettingsInput!) {
    updateUserSettings(input: $input) {
      id
      settings {
        spotifyPreview
      }
    }
  }
`;

export interface UserSettingsInput {
  spotifyPreview?: boolean;
  allowFriendInvites?: boolean;
}

export function useUpdateUserSettingsMutation() {
  const [commit, isInFlight] = useMutation<UseUpdateUserSettingsMutationType>(
    UpdateUserSettingsMutation
  );

  const mutate = (input: UserSettingsInput): Promise<void> => {
    return new Promise((resolve, reject) => {
      commit({
        variables: { input },
        onCompleted: (response) => {
          if (!response.updateUserSettings) {
            reject(new Error('Failed to update settings'));
          } else {
            resolve();
          }
        },
        onError: reject,
      });
    });
  };

  return { mutate, isLoading: isInFlight };
}
