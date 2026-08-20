import { createClient } from "../../../lib/supabase";
import { authorize } from "../superadmin/route";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    await authorize();
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    const supabase = await createClient();

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
