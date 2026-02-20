---
name: market-briefing
description: Use this skill when the user asks for a "daily briefing", "what happened today", or a summary of the Brazilian market (B3, Ibovespa, USD, Rates).
---

# Market Briefing Skill

## Goal
Provide a concise but comprehensive overview of today's market action, primarily focused on Brazil (B3), but including key international context (S&P 500/Nasdaq) that drives local sentiment.

## Steps

1. **Check Top Movers & Index**:
   - Get the current price and % change for `BOVA11` (Ibovespa Proxy) and `SMAL11` (Small Cap Proxy).
   - Get the USD/BRL rate (using financial_search "USD BRL rate today").
   - Perform a news search for "Ibovespa biggest movers today" or "why is Ibovespa up/down today".

2. **Check Key Macro Drivers**:
   - **Interest Rates**: Check the DI Future rates (DI1F25, DI1F27) if available, or search news for "curva de juros hoje".
   - **Commodities**: Check Brent Oil and Iron Ore prices (Dalian/Singapore) as they drive PETR4 and VALE3.

3. **Check Corporate News**:
   - Search for "notícias corporativas destaque hoje Brasil".
   - Look for earnings releases or material facts (Fatos Relevantes) for major constituents (PETR4, VALE3, ITUB4, BBDC4).

## Output Format

**Market Pulse**
- **Ibovespa**: 128,000 (+0.5%)
- **Dólar**: 5.05 (-0.2%)
- **S&P 500**: 5,100 (+0.1%)

**What Drove Markets Today**
> 1-2 sentences summarizing the main narrative (e.g., "Tech rally in US spillover" or "Fiscal concerns locally").

**Top Stories**
- **Hardware Co X**: +15% on earnings beat.
- **Oil Co Y**: -2% on lower Brent prices.

**In the Money (Winners)** 🟢
- Ticker1 (+X%)
- Ticker2 (+Y%)

**Out of the Money (Losers)** 🔴
- Ticker3 (-Z%)
- Ticker4 (-W%)

**Looking Ahead**
- Upcoming events tomorrow (COPOM minutes, Payroll, etc.)
