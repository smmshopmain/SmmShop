export const USER_ROLES = ["user", "staff", "secondary_admin", "admin"] as const;
export const ASSIGNABLE_USER_ROLES = ["user", "staff", "secondary_admin"] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type AssignableUserRole = (typeof ASSIGNABLE_USER_ROLES)[number];

export function isAdminRole(role: unknown) {
  return role === "admin" || role === "secondary_admin" || role === "staff";
}

export function roleLabel(role: unknown) {
  if (role === "admin") return "Main admin";
  if (role === "secondary_admin") return "Secondary admin";
  if (role === "staff") return "Staff";
  return "User";
}
