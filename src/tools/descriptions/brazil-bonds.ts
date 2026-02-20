/**
 * Rich description for the get_brazil_bonds tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const BRAZIL_BONDS_DESCRIPTION = `
Fetch historical Tesouro Direto (Brazilian government bond) prices and rates from Tesouro Transparente.

## When to Use

- The user asks about **Tesouro Direto** bond rates or prices (e.g., "What was the NTN-B rate in 2023?")
- Comparing a portfolio to **Brazilian government bond benchmarks** (Tesouro Selic, Tesouro IPCA+)
- Analyzing **fixed-income yields** over a period for Brazilian bonds
- Checking **historical buy/sell rates** for a specific Tesouro Direto bond type

## When NOT to Use

- For Brazilian inflation (IPCA) or rate benchmarks (CDI, Selic) — use get_macro_series
- For IMA-B bond index returns — use get_macro_series with imab/imab5/imab5plus
- For corporate bonds or US Treasury bonds — not covered by this tool
- For live (intraday) Tesouro prices — data is daily, from morning session

## Inputs

- **start_date / end_date**: Date range in YYYY-MM-DD format (data available from 2004-12-31)
- **bond_type** (optional): Filter by bond type code:
  - LFT – Tesouro Selic (floating rate, linked to Selic)
  - LTN – Tesouro Prefixado (fixed rate, no coupon)
  - NTN-F – Tesouro Prefixado com Juros Semestrais (fixed rate + semiannual coupons)
  - NTN-B-P – Tesouro IPCA+ (inflation-linked, no coupon)
  - NTN-B – Tesouro IPCA+ com Juros Semestrais (inflation-linked + semiannual coupons)
  - NTN-C – Tesouro IGPM+ com Juros Semestrais (IGP-M-linked + coupons)
  - NTN-R – Tesouro Renda+ Aposentadoria Extra
  - NTN-E – Tesouro Educa+

## Outputs

- **bonds**: Array of bond records with fields: bond_type, bond_name, asset_code, maturity_date, trade_date, buy_rate, sell_rate, buy_pu, sell_pu, base_pu
  - Rates are decimals (0.065 = 6.5% per year)
  - Unit prices (PU) are in BRL
  - asset_code is e.g. "NTN-B/2035" combining type and maturity year
- **meta**: Bond type name mapping and interpretation notes
`.trim();
