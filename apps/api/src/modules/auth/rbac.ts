// 9 roles per spec/05-security.md
export const ROLES = [
  'traveler',
  'org.owner',
  'org.admin',
  'org.editor',
  'guide',
  'moderator',
  'kb.editor',
  'admin',
  'superadmin',
] as const;

export type Role = (typeof ROLES)[number];

// Coarse permission map. Fine-grained checks live in service layer.
const GRANTS: Record<string, Role[]> = {
  'post:create': ['traveler', 'org.owner', 'org.admin', 'org.editor', 'guide'],
  'post:moderate': ['moderator', 'admin', 'superadmin'],
  'org:manage': ['org.owner', 'org.admin'],
  'kb:manage': ['kb.editor', 'admin', 'superadmin'],
  'admin:access': ['admin', 'superadmin', 'moderator', 'kb.editor'],
  'user:manage': ['admin', 'superadmin'],
};

export function can(roles: string[], permission: string): boolean {
  const allowed = GRANTS[permission];
  if (!allowed) return false;
  return roles.some((r) => allowed.includes(r as Role));
}
