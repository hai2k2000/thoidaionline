import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/serverSession";
import { serverSupabase } from "@/lib/serverSupabase";

export async function GET() {
  const actor = await getSessionUser();
  if (!actor) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!actor.rbacPermissions.includes("record.discover")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const [categories, types, forms] = await Promise.all([
    serverSupabase.from("db_categories").select("id,parent_id,code,name,department_id,active,sort_order").eq("active", true).order("sort_order"),
    serverSupabase.from("db_record_types").select("id,category_id,code,name,description,active").eq("active", true).order("name"),
    serverSupabase.from("db_form_definitions").select("id,record_type_id,version,status,search_config,display_config,db_form_fields(id,field_key,label,data_type,required,searchable,options,validation,sort_order)").eq("status", "published").eq("version", 1),
  ]);
  if (categories.error || types.error || forms.error) return NextResponse.json({ error: "catalog_read_failed" }, { status: 500 });
  return NextResponse.json({ categories: categories.data ?? [], recordTypes: types.data ?? [], forms: forms.data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}
