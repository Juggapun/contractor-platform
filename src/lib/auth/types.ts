/**
 * Mirrors public.profiles (supabase/migrations/0004_profiles.sql).
 * `role` is intentionally never settable from a signup/update payload —
 * see authService.ts and docs/AUTHENTICATION.md#role-handling.
 */
export type UserRole = 'customer' | 'contractor' | 'admin';

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CurrentUser {
  id: string;
  email: string | null;
  profile: Profile;
}

export interface SignUpInput {
  email: string;
  password: string;
  fullName?: string;
}

export interface SignInInput {
  email: string;
  password: string;
}
