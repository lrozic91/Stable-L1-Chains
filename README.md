# Stable L1 Chains

Statična web stranica (HTML) o stablecoin chainovima Stable (Tether) i Arc (Circle): izdavatelji, statistike i usporedba.

Objava: Cloudflare Workers. Statične datoteke su u public/, a src/worker.js poslužuje /api/data za gumb Osvježi (DefiLlama, CoinGecko).

Svaki push na granu main automatski se objavljuje preko Cloudflare Workers Builds na https://stable-l1-chains.mojaradnadomena.com/
Stranice: Tether, Circle, Stable, Arc, Usporedba, Strategija (HR / EN).
