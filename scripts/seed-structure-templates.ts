/**
 * Seed / refresh structure_templates from code skeletons (Fable-quality layouts).
 * Usage: npm run seed:structures
 * Needs SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL.
 *
 * Layouts live in lib/structureTemplates.ts — edit there, then re-seed.
 * Optional future: regenerate HTML via Fable API and overwrite rows.
 */
import { createClient } from "@supabase/supabase-js";
import { STRUCTURE_LAYOUTS } from "../lib/structureTemplates";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const admin = createClient(url, key);
  for (const layout of STRUCTURE_LAYOUTS) {
    const { error } = await admin.from("structure_templates").upsert(
      {
        id: layout.id,
        label: layout.label,
        description: layout.description,
        html: layout.html,
        css: layout.css,
        js: layout.js,
        created_by_model: "seed-code",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
    if (error) {
      console.error(layout.id, error.message);
    } else {
      console.log("ok", layout.id);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
