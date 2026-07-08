// Fonte única de verdade sobre quais sets o catálogo suporta.
// Evita hardcode de códigos de set espalhado pelos outros endpoints.

export async function getActiveSets(supabase) {
  const { data, error } = await supabase
    .from('sets')
    .select('*')
    .eq('ativo', true)
    .order('release_date', { ascending: true, nullsFirst: true })
  if (error) throw error
  return data || []
}

export async function getSetByCode(supabase, code) {
  const { data, error } = await supabase
    .from('sets')
    .select('*')
    .eq('id', code)
    .maybeSingle()
  if (error) throw error
  return data
}
