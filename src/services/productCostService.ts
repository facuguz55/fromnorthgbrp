const SB_URL = 'https://tnmmbfcbviowhunnrzix.supabase.co';
const SB_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRubW1iZmNidmlvd2h1bm5yeml4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMTc4MzcsImV4cCI6MjA4OTc5MzgzN30.ZZD8evIrlfY_77-DEh47L-JJxFOxhH8L9xZ_NjHN6QU';

export interface ProductCost {
  id?: string;
  product_name: string;
  costo_compra: number;
  costo_empaque: number;
  costo_envio: number;
  costo_agencia: number;
  updated_at?: string;
}

export async function getProductCosts(): Promise<ProductCost[]> {
  const res = await fetch(
    `${SB_URL}/rest/v1/product_costs?select=*&order=product_name.asc`,
    {
      headers: {
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
      },
    },
  );
  if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
  return res.json();
}

export async function upsertProductCost(cost: ProductCost): Promise<void> {
  const res = await fetch(`${SB_URL}/rest/v1/product_costs`, {
    method: 'POST',
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      product_name: cost.product_name,
      costo_compra: cost.costo_compra,
      costo_empaque: cost.costo_empaque,
      costo_envio: cost.costo_envio,
      costo_agencia: cost.costo_agencia,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
}

export async function deleteProductCost(productName: string): Promise<void> {
  const res = await fetch(
    `${SB_URL}/rest/v1/product_costs?product_name=eq.${encodeURIComponent(productName)}`,
    {
      method: 'DELETE',
      headers: {
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
      },
    },
  );
  if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
}
