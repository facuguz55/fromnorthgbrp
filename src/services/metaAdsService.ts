const GRAPH_API = 'https://graph.facebook.com/v19.0';

// ── Types ──────────────────────────────────────────────────────────────────────

export type MetaStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'DELETED';
export type DatePreset =
  | 'today' | 'yesterday' | 'last_7d' | 'last_14d'
  | 'last_30d' | 'this_month' | 'last_month';

export interface MetaCampaign {
  id: string;
  name: string;
  status: MetaStatus;
  objective: string;
  daily_budget?: string;
  lifetime_budget?: string;
}

export interface MetaInsight {
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  impressions: number;
  clicks: number;
  ctr: number;
  spend: number;
  reach: number;
  frequency: number;
  purchases: number;
  purchaseValue: number;
  date_start: string;
  date_stop: string;
}

export interface MetaAd {
  id: string;
  name: string;
  status: MetaStatus;
  campaign_id: string;
  adset_id: string;
}

export interface MetaAlert {
  level: 'campaign' | 'ad';
  id: string;
  name: string;
  type: 'low_ctr' | 'very_low_ctr' | 'high_frequency' | 'no_impressions' | 'high_spend_no_clicks' | 'low_roas';
  message: string;
  severity: 'warning' | 'critical';
  value: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function metaGet<T>(path: string, token: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(`${GRAPH_API}${path}?${qs}`);
  const json = await res.json();
  if (json.error) throw new Error(`Meta API: ${json.error.message} (code ${json.error.code})`);
  return json as T;
}

function extractAction(actions: { action_type: string; value: string }[] | undefined, type: string): number {
  return parseFloat(actions?.find(a => a.action_type === type)?.value ?? '0') || 0;
}

// ── Campaigns ──────────────────────────────────────────────────────────────────

export async function fetchMetaCampaigns(token: string, accountId: string): Promise<MetaCampaign[]> {
  const accountFmt = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
  const result = await metaGet<{ data: MetaCampaign[] }>(
    `/${accountFmt}/campaigns`,
    token,
    {
      fields: 'id,name,status,objective,daily_budget,lifetime_budget',
      effective_status: `["ACTIVE","PAUSED","ARCHIVED"]`,
      limit: '100',
    },
  );
  return result.data ?? [];
}

// ── Insights ───────────────────────────────────────────────────────────────────

interface RawInsight {
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  spend?: string;
  reach?: string;
  frequency?: string;
  date_start?: string;
  date_stop?: string;
  actions?: { action_type: string; value: string }[];
  action_values?: { action_type: string; value: string }[];
}

export async function fetchMetaInsights(
  token: string,
  accountId: string,
  datePreset: DatePreset = 'last_7d',
  level: 'campaign' | 'adset' | 'ad' = 'campaign',
): Promise<MetaInsight[]> {
  const accountFmt = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
  const result = await metaGet<{ data: RawInsight[] }>(
    `/${accountFmt}/insights`,
    token,
    {
      fields: 'campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,impressions,clicks,ctr,spend,reach,frequency,actions,action_values',
      date_preset: datePreset,
      level,
      effective_status: `["ACTIVE","PAUSED","ARCHIVED"]`,
      limit: '200',
    },
  );

  return (result.data ?? []).map(r => ({
    campaign_id:   r.campaign_id,
    campaign_name: r.campaign_name,
    adset_id:      r.adset_id,
    adset_name:    r.adset_name,
    ad_id:         r.ad_id,
    ad_name:       r.ad_name,
    impressions:   parseInt(r.impressions  ?? '0') || 0,
    clicks:        parseInt(r.clicks       ?? '0') || 0,
    ctr:           parseFloat(r.ctr        ?? '0') || 0,
    spend:         parseFloat(r.spend      ?? '0') || 0,
    reach:         parseInt(r.reach        ?? '0') || 0,
    frequency:     parseFloat(r.frequency  ?? '0') || 0,
    purchases:     extractAction(r.actions,       'purchase'),
    purchaseValue: extractAction(r.action_values, 'purchase'),
    date_start:    r.date_start ?? '',
    date_stop:     r.date_stop  ?? '',
  }));
}

// ── Ads ────────────────────────────────────────────────────────────────────────

export async function fetchMetaAds(token: string, accountId: string): Promise<MetaAd[]> {
  const accountFmt = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
  const result = await metaGet<{ data: MetaAd[] }>(
    `/${accountFmt}/ads`,
    token,
    {
      fields: 'id,name,status,campaign_id,adset_id',
      effective_status: `["ACTIVE","PAUSED"]`,
      limit: '200',
    },
  );
  return result.data ?? [];
}

// ── Alert generator ────────────────────────────────────────────────────────────

export function generateMetaAlerts(insights: MetaInsight[], level: 'campaign' | 'ad'): MetaAlert[] {
  const alerts: MetaAlert[] = [];

  for (const ins of insights) {
    const id   = level === 'campaign' ? (ins.campaign_id ?? '') : (ins.ad_id ?? '');
    const name = level === 'campaign' ? (ins.campaign_name ?? '') : (ins.ad_name ?? '');

    if (ins.impressions === 0 && ins.spend > 0) {
      alerts.push({
        level, id, name,
        type: 'no_impressions',
        severity: 'critical',
        message: `Gasto de $${ins.spend.toFixed(2)} sin impresiones`,
        value: ins.spend,
      });
      continue;
    }

    if (ins.impressions > 100) {
      if (ins.ctr < 0.5) {
        alerts.push({
          level, id, name,
          type: 'very_low_ctr',
          severity: 'critical',
          message: `CTR muy bajo: ${ins.ctr.toFixed(2)}% (mínimo recomendado: 1%)`,
          value: ins.ctr,
        });
      } else if (ins.ctr < 1) {
        alerts.push({
          level, id, name,
          type: 'low_ctr',
          severity: 'warning',
          message: `CTR bajo: ${ins.ctr.toFixed(2)}% (recomendado: ≥1%)`,
          value: ins.ctr,
        });
      }
    }

    if (ins.frequency > 4) {
      alerts.push({
        level, id, name,
        type: 'high_frequency',
        severity: ins.frequency > 6 ? 'critical' : 'warning',
        message: `Frecuencia alta: ${ins.frequency.toFixed(1)}x (la misma persona ve el ad ${ins.frequency.toFixed(1)} veces en promedio)`,
        value: ins.frequency,
      });
    }

    if (ins.clicks === 0 && ins.spend > 5) {
      alerts.push({
        level, id, name,
        type: 'high_spend_no_clicks',
        severity: 'warning',
        message: `$${ins.spend.toFixed(2)} gastado sin ningún clic`,
        value: ins.spend,
      });
    }

    // ROAS bajo: solo si hubo gasto significativo y hay datos de conversión
    if (ins.spend > 10 && ins.purchases > 0) {
      const roas = ins.purchaseValue / ins.spend;
      if (roas < 1) {
        alerts.push({
          level, id, name,
          type: 'low_roas',
          severity: 'critical',
          message: `ROAS crítico: ${roas.toFixed(2)}x — gastás más de lo que generás`,
          value: roas,
        });
      } else if (roas < 2) {
        alerts.push({
          level, id, name,
          type: 'low_roas',
          severity: 'warning',
          message: `ROAS bajo: ${roas.toFixed(2)}x (recomendado: ≥2x)`,
          value: roas,
        });
      }
    }
  }

  return alerts.sort((a, b) => {
    if (a.severity === b.severity) return 0;
    return a.severity === 'critical' ? -1 : 1;
  });
}

// ── Summary ────────────────────────────────────────────────────────────────────

export interface MetaSummary {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  avgCtr: number;
  totalReach: number;
  avgFrequency: number;
  totalPurchases: number;
  totalRevenue: number;
  overallRoas: number;
  avgCpa: number;
}

export function computeMetaSummary(insights: MetaInsight[]): MetaSummary {
  const totalSpend       = insights.reduce((s, i) => s + i.spend, 0);
  const totalImpressions = insights.reduce((s, i) => s + i.impressions, 0);
  const totalClicks      = insights.reduce((s, i) => s + i.clicks, 0);
  const totalReach       = insights.reduce((s, i) => s + i.reach, 0);
  const totalPurchases   = insights.reduce((s, i) => s + i.purchases, 0);
  const totalRevenue     = insights.reduce((s, i) => s + i.purchaseValue, 0);
  const avgCtr       = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const avgFrequency = totalReach > 0 ? totalImpressions / totalReach : 0;
  const overallRoas  = totalSpend > 0 ? totalRevenue / totalSpend : 0;
  const avgCpa       = totalPurchases > 0 ? totalSpend / totalPurchases : 0;
  return { totalSpend, totalImpressions, totalClicks, avgCtr, totalReach, avgFrequency, totalPurchases, totalRevenue, overallRoas, avgCpa };
}
