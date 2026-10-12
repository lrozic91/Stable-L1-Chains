// Statična stranica iz ./public, a /api/data skuplja svježe podatke s DefiLlame i CoinGecka.
const STABLE_CIRCULATING = 27.047e9; // STABLE u optjecaju (CoinGecko), za izračun tržišne kapitalizacije ako CoinGecko ne odgovori

async function getJSON(url) {
  const res = await fetch(url, { headers: { accept: "application/json", "user-agent": "stable-l1-chains" } });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

const safe = (p) => p.then((v) => v, () => null);

// Dnevne transakcije na Stableu: CSV s grafa "Daily Transactions" na Stablescanu (Etherscan), zadnjih 30 dana
async function stableDailyTx() {
  const res = await fetch("https://stablescan.xyz/chart/tx?output=csv", {
    headers: { accept: "text/csv,*/*", "user-agent": "Mozilla/5.0 (compatible; stable-l1-chains)" },
  });
  if (!res.ok) throw new Error(`stablescan → ${res.status}`);
  const rows = [];
  for (const line of (await res.text()).split(/\r?\n/)) {
    const m = line.match(/^"?[^",]*"?,"?(\d{9,11})"?,"?(\d+)"?/);
    if (m) rows.push([new Date(+m[1] * 1000).toISOString().slice(0, 10), +m[2]]);
  }
  if (rows.length < 2) throw new Error("stablescan: prazan CSV");
  return rows.slice(-30);
}

async function collect() {
  const ov = (kind, chain) =>
    safe(getJSON(`https://api.llama.fi/overview/${kind}/${chain}?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true`));
  const [coins, chains, scChains, feesStable, feesArc, dexStable, dexArc, gecko, llamaPrice, stableTx] = await Promise.all([
    safe(getJSON("https://stablecoins.llama.fi/stablecoins?includePrices=false")),
    safe(getJSON("https://api.llama.fi/v2/chains")),
    safe(getJSON("https://stablecoins.llama.fi/stablecoinchains")),
    ov("fees", "Stable"), ov("fees", "Arc"), ov("dexs", "Stable"), ov("dexs", "Arc"),
    safe(getJSON("https://api.coingecko.com/api/v3/simple/price?ids=stable-2&vs_currencies=usd&include_market_cap=true")),
    safe(getJSON("https://coins.llama.fi/prices/current/coingecko:stable-2")),
    safe(stableDailyTx()),
  ]);

  const out = { fetchedAt: new Date().toISOString() };
  if (coins?.peggedAssets) {
    const usd = (a) => a?.circulating?.peggedUSD || 0;
    out.usdt = usd(coins.peggedAssets.find((a) => a.symbol === "USDT"));
    out.usdc = usd(coins.peggedAssets.find((a) => a.symbol === "USDC"));
    out.stablecoinsTotal = coins.peggedAssets.reduce((s, a) => s + usd(a), 0);
  }
  if (Array.isArray(chains)) {
    out.stableTvl = chains.find((c) => c.name === "Stable")?.tvl ?? null;
    out.arcTvl = chains.find((c) => c.name === "Arc")?.tvl ?? null;
  }
  if (Array.isArray(scChains)) {
    out.stableStablecoins = scChains.find((c) => c.name === "Stable")?.totalCirculatingUSD?.peggedUSD ?? null;
    out.arcStablecoins = scChains.find((c) => c.name === "Arc")?.totalCirculatingUSD?.peggedUSD ?? null;
  }
  out.stableFees24h = feesStable?.total24h ?? null;
  out.arcFees24h = feesArc?.total24h ?? null;
  out.stableDex24h = dexStable?.total24h ?? null;
  out.arcDex24h = dexArc?.total24h ?? null;
  out.arcDex7d = dexArc?.total7d ?? null;
  const g = gecko?.["stable-2"];
  const p = llamaPrice?.coins?.["coingecko:stable-2"]?.price;
  out.stableMcap = g?.usd_market_cap || (p ? p * STABLE_CIRCULATING : null);
  out.stableTxDaily = stableTx;
  return out;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/data") {
      const cache = caches.default;
      const key = new Request(url.origin + "/api/data");
      let res = await cache.match(key);
      if (!res) {
        const data = await collect();
        res = new Response(JSON.stringify(data), {
          headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=60" },
        });
        ctx.waitUntil(cache.put(key, res.clone()));
      }
      return res;
    }
    return env.ASSETS.fetch(request);
  },
};
