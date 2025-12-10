/**
 * Role constants and utilities for the frontend.
 * Provides consistent role definitions, labels, colors, and descriptions.
 */

export const USER_ROLES = {
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
  VIEWER: 'VIEWER',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

/**
 * Human-readable labels for each role
 */
export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Admin',
  MEMBER: 'Member',
  VIEWER: 'Viewer',
};

/**
 * Detailed descriptions of what each role can do
 */
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  ADMIN: 'Full control over application and all tenants',
  MEMBER: 'Can create and manage own records',
  VIEWER: 'Read-only access',
};

/**
 * Tailwind CSS classes for role display/styling
 * Used for role badges and other visual indicators
 */
export const ROLE_COLORS: Record<UserRole, string> = {
  ADMIN: 'bg-purple-100 text-purple-800',
  MEMBER: 'bg-green-100 text-green-800',
  VIEWER: 'bg-gray-100 text-gray-800',
};

/**
 * Role options for dropdowns and selection components
 */
export const ROLE_OPTIONS = [
  { value: USER_ROLES.ADMIN, label: ROLE_LABELS.ADMIN },
  { value: USER_ROLES.MEMBER, label: ROLE_LABELS.MEMBER },
  { value: USER_ROLES.VIEWER, label: ROLE_LABELS.VIEWER },
] as const;

/**
 * Get the display label for a role
 */
export function getRoleLabel(role: UserRole | string): string {
  return ROLE_LABELS[role as UserRole] || role;
}

/**
 * Get the description for a role
 */
export function getRoleDescription(role: UserRole | string): string {
  return ROLE_DESCRIPTIONS[role as UserRole] || '';
}

/**
 * Get the CSS classes for a role badge
 */
export function getRoleColors(role: UserRole | string): string {
  return ROLE_COLORS[role as UserRole] || ROLE_COLORS.VIEWER;
}
