export async function getProfileByUserId(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
  return data || null;
}
