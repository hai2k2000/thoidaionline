import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/serverSession";
import { serverSupabase } from "@/lib/serverSupabase";
import { canAccessRecordType } from "@/lib/databaseManagement/policy";

export async function GET() {
  const actor = await getSessionUser();
  if (!actor) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!actor.rbacPermissions.includes("record.discover")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const [categories, types, forms] = await Promise.all([
    serverSupabase.from("db_categories").select("id,parent_id,code,name,department_id,active,sort_order").eq("active", true).order("sort_order"),
    serverSupabase.from("db_record_types").select("id,category_id,code,name,description,active,sort_order").eq("active", true).order("sort_order", { ascending: true, nullsFirst: false }).order("name", { ascending: true }),
    serverSupabase.from("db_form_definitions").select("id,record_type_id,version,status,search_config,display_config,db_form_fields(id,field_key,label,data_type,required,searchable,options,validation,sort_order)").eq("status", "published").eq("version", 1),
  ]);
  if (categories.error || types.error || forms.error) return NextResponse.json({ error: "catalog_read_failed" }, { status: 500 });
  const categoryCodes = new Map((categories.data ?? []).map((category) => [category.id, category.code]));
  const visibleTypes = (types.data ?? []).filter((type) => canAccessRecordType(actor, type.code, categoryCodes.get(type.category_id)));
  const visibleTypeIds = new Set(visibleTypes.map((type) => type.id));
  const visibleForms = (forms.data ?? []).filter((form) => visibleTypeIds.has(form.record_type_id));
  const needsDepartments = visibleForms.some((form) => (form.db_form_fields ?? []).some((field) => field.data_type === "department"));
  const needsPeople = visibleForms.some((form) => (form.db_form_fields ?? []).some((field) => field.data_type === "person" || field.field_key === "participants"));
  const [{ data: departments, error: departmentsError }, { data: people, error: peopleError }] = await Promise.all([
    needsDepartments ? serverSupabase.from("departments").select("id,name").eq("active", true).order("name") : Promise.resolve({ data: [], error: null }),
    needsPeople ? serverSupabase.from("staff_users").select("id,full_name").eq("active", true).order("full_name") : Promise.resolve({ data: [], error: null }),
  ]);
  if (departmentsError || peopleError) return NextResponse.json({ error: "catalog_read_failed" }, { status: 500 });
  const countryOptions = ["Việt Nam", "Lào", "Campuchia", "Trung Quốc", "Nhật Bản", "Hàn Quốc", "Hoa Kỳ", "Pháp", "Đức", "Vương quốc Anh"].map((label) => ({ value: label, label }));
  const formsWithSources = visibleForms.map((form) => ({
    ...form,
    db_form_fields: (form.db_form_fields ?? []).map((field) => ({
      ...field,
      options: field.data_type === "department" ? (departments ?? []).map((item) => ({ value: item.id, label: item.name }))
        : field.data_type === "person" || field.field_key === "participants" ? (people ?? []).map((item) => ({ value: item.id, label: item.full_name }))
        : field.data_type === "country" ? countryOptions : field.options,
    })),
  }));
  const categoryRows = categories.data ?? [];
  const visibleCategoryIds = new Set(visibleTypes.map((type) => type.category_id));
  for (const category of categoryRows) if (visibleCategoryIds.has(category.id) && category.parent_id) visibleCategoryIds.add(category.parent_id);
  for (const category of categoryRows) if (category.parent_id && visibleCategoryIds.has(category.parent_id)) visibleCategoryIds.add(category.id);
  return NextResponse.json({ categories: categoryRows.filter((category) => visibleCategoryIds.has(category.id)), recordTypes: visibleTypes, forms: formsWithSources }, { headers: { "Cache-Control": "private, no-store" } });
}
