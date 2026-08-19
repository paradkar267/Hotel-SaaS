import { createClient } from "../../../lib/supabase";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSession, AccessError } from "../../../lib/auth";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) throw new AccessError("Not signed in.", 401);
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('logos')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error("Storage upload error:", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    const { data: publicUrlData } = supabase.storage
      .from('logos')
      .getPublicUrl(fileName);

    return Response.json({ url: publicUrlData.publicUrl });
  } catch (error: any) {
    console.error("Upload error:", error);
    return Response.json({ error: error.message || "Upload failed" }, { status: 500 });
  }
}
