import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { env as pubEnv } from '$env/dynamic/public';

export const supabaseAdmin = createClient(
  pubEnv.PUBLIC_SUPABASE_URL,
  env.PRIVATE_SUPABASE_SERVICE_KEY
);
