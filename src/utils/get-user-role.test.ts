import { getUserRole, type AppRole } from './get-user-role';

describe('getUserRole', () => {
  // Highest priority: superadmin
  it('returns "superadmin" when superadmin flag is true (number 1)', () => {
    const meta = { is_qr_superadmin: 1, is_qr_admin: 1, is_qr_member: 1 };
    expect(getUserRole(meta)).toBe<AppRole>('superadmin');
  });

  it('returns "superadmin" when superadmin flag is boolean true', () => {
    const meta = { is_qr_superadmin: true, is_qr_admin: true, is_qr_member: true };
    expect(getUserRole(meta)).toBe<AppRole>('superadmin');
  });

  // Next priority: admin
  it('returns "admin" when admin is true and superadmin is false/0', () => {
    const meta = { is_qr_superadmin: 0, is_qr_admin: 1, is_qr_member: 1 };
    expect(getUserRole(meta)).toBe<AppRole>('admin');
  });

  it('returns "admin" when admin is boolean true and superadmin is false', () => {
    const meta = { is_qr_superadmin: false, is_qr_admin: true, is_qr_member: true };
    expect(getUserRole(meta)).toBe<AppRole>('admin');
  });

  // Lowest priority: member
  it('returns "member" when only member flag is true (number 1)', () => {
    const meta = { is_qr_superadmin: 0, is_qr_admin: 0, is_qr_member: 1 };
    expect(getUserRole(meta)).toBe<AppRole>('member');
  });

  it('returns "member" when only member is boolean true', () => {
    const meta = { is_qr_member: true };
    expect(getUserRole(meta)).toBe<AppRole>('member');
  });

  // No role flags
  it('returns null when no role flags are true', () => {
    const meta = { is_qr_superadmin: 0, is_qr_admin: 0, is_qr_member: 0 };
    expect(getUserRole(meta)).toBeNull();
  });

  it('returns null for empty metadata object', () => {
    const meta = {} as any;
    expect(getUserRole(meta)).toBeNull();
  });

  it('returns null when metadata is null or undefined', () => {
    expect(getUserRole(null as any)).toBeNull();
    expect(getUserRole(undefined as any)).toBeNull();
  });

  // Mixed/edge values
  it('treats non-true, non-1 values as false', () => {
    const meta = { is_qr_superadmin: 2, is_qr_admin: 'yes', is_qr_member: 0 } as any;
    expect(getUserRole(meta)).toBeNull();
  });
});
