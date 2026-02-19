import { useMutation, graphql } from 'react-relay';
import type { useSwitchTenantMutation as UseSwitchTenantMutationType } from '../../__generated__/useSwitchTenantMutation.graphql';

const SwitchTenantMutation = graphql`
  mutation useSwitchTenantMutation($tenantId: String!) {
    switchTenant(tenantId: $tenantId) {
      id
      githubLogin
      displayName
      avatarUrl
      activeTenant {
        id
        name
        type
        role
      }
      availableTenants {
        id
        name
        type
        role
      }
    }
  }
`;

/**
 * Hook to switch the active tenant for the current user.
 * @returns Mutation function and loading state
 */
export function useSwitchTenantMutation() {
  const [commit, isInFlight] = useMutation<UseSwitchTenantMutationType>(SwitchTenantMutation);

  const mutate = async (tenantId: string) => {
    return new Promise((resolve, reject) => {
      commit({
        variables: { tenantId },
        onCompleted: (response) => {
          resolve(response.switchTenant);
        },
        onError: reject,
      });
    });
  };

  return { mutate, isLoading: isInFlight };
}
