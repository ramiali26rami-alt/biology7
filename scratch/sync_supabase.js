import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = 'https://plppzszhsvgocmpseahp.supabase.co';
const supabaseAnonKey = 'sb_publishable_KZjLLGAHIXWpx98edVatMg_1MO2wkQx';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function sync() {
  const configPath = path.join(__dirname, '..', 'public', 'lessons_config.json');
  const lessons = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  console.log(`Syncing ${lessons.length} lessons to Supabase system_settings...`);

  const { data, error } = await supabase
    .from('system_settings')
    .upsert({
      key: 'curriculum_data',
      value: lessons,
      updated_at: new Date().toISOString()
    });

  if (error) {
    console.error('Error syncing to Supabase:', error.message);
  } else {
    console.log('✅ Successfully synced curriculum to Supabase cloud!');
  }
}

sync();
