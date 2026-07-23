import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://plppzszhsvgocmpseahp.supabase.co';
const supabaseAnonKey = 'sb_publishable_KZjLLGAHIXWpx98edVatMg_1MO2wkQx';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
