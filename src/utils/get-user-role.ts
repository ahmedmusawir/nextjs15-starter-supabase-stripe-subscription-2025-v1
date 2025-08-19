// Define the possible application roles for strict type checking
export type AppRole = 'superadmin' | 'admin' | 'member';

/**
 * Derives a single role string from a Supabase user's metadata.
 * Checks from highest permission to lowest and returns the first match.
 * If nothing matches, returns null.
 */
export const getUserRole = (userMetaData: any): AppRole | null => {
  if (!userMetaData) return null;

  // Support numeric (1/0), boolean, and common string variants ('1', 'true')
  const isTrue = (v: unknown) => {
    if (v === 1 || v === true) return true;
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase();
      return s === '1' || s === 'true';
    }
    return false;
  };

  if (isTrue(userMetaData.is_qr_superadmin)) return 'superadmin';
  if (isTrue(userMetaData.is_qr_admin)) return 'admin';
  if (isTrue(userMetaData.is_qr_member)) return 'member';

  return null;
};
