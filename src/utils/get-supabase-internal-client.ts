import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/generated/database.types';

export function getSupabaseInternalClient() {

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  return createClient<Database, "internal">(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      db: {
        schema: 'internal'
      }
    }
  );
}