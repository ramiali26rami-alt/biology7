import { createClient, type User } from '@supabase/supabase-js';

const supabaseUrl = 'https://plppzszhsvgocmpseahp.supabase.co';
const supabaseAnonKey = 'sb_publishable_KZjLLGAHIXWpx98edVatMg_1MO2wkQx';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

let anonymousSignInPromise: ReturnType<typeof supabase.auth.signInAnonymously> | null = null;

/** Admin authorization must come from immutable app metadata set by Supabase. */
export function isAdminUser(user: User | null | undefined): boolean {
  return user?.app_metadata?.role === 'admin';
}

/**
 * Give each student device a real Supabase identity so RLS can protect its rows.
 * The promise is shared to avoid duplicate anonymous users during app startup.
 */
export async function ensureAuthenticatedSession() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (sessionData.session) return sessionData.session;

  if (!anonymousSignInPromise) {
    anonymousSignInPromise = supabase.auth.signInAnonymously();
  }

  try {
    const { data, error } = await anonymousSignInPromise;
    if (error) throw error;
    if (!data.session) throw new Error('Supabase did not return an authenticated session.');
    return data.session;
  } finally {
    anonymousSignInPromise = null;
  }
}

/** Authorization headers for local/server admin endpoints. */
export async function getAdminAuthHeaders(): Promise<Record<string, string>> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const session = data.session;
  if (!session || !isAdminUser(session.user)) {
    throw new Error('Admin authorization required.');
  }
  return { Authorization: `Bearer ${session.access_token}` };
}
