---
name: comparables
description: Perform a Comparable Company Analysis (Comps) to value a company relative to its peers.
---

# Comparable Company Analysis (Comps)

## Goal
Value a target company by comparing its trading multiples (EV/EBITDA, P/E, P/S) to a set of similar peer companies.

## Steps

1. **Select Peers**
   - Identify 3-5 public companies in the same industry/sector with similar size/operations.
   - For Brazil: Prioritize other B3 companies first, then global peers if none exist.
   - *Example (PETR4)*: Peers could be PRIO3, RRRP3 (local) or Exxon, Chevron (global).
   - *Example (WEGE3)*: Peers could be Siemens, ABB, Rockwell Automation.

2. **Retrieve Multiples (Current)**
   - Use `financial_metrics` or `financial_search` to get:
     - **EV/EBITDA** (Enterprise Value / EBITDA)
     - **P/E** (Price / Earnings)
     - **P/S** (Price / Sales) - useful for high growth/unprofitable cos.
   - *Important*: Use **Forward (NTM)** multiples if available, otherwise TTM (Trailing Twelve Months).

3. **Calculate Peer Averages**
   - Create a table of peers and their multiples.
   - Calculate the **Mean** and **Median** for each multiple.
   - *Exclude outliers* (e.g., negative P/E or >100x if others are 10x).

4. **Apply to Target**
   - Get the target company's financial metrics (EBITDA, Net Income, Revenue).
   - Multiply the peer average multiple by the target's metric to get implied value.
   - **Implied Share Price**:
     - (Implied Market Cap) / Share Count
     - OR if using EV/EBITDA: (Implied EV - Net Debt) / Share Count.

## Output Format

### Peer Group Table

| Peer | Ticker | EV/EBITDA | P/E | P/S |
|---|---|---|---|---|
| Peer 1 | Ticker1 | 5.2x | 8.5x | 1.1x |
| Peer 2 | Ticker2 | 6.1x | 10.2x | 1.4x |
| **Median** | | **5.6x** | **9.3x** | **1.2x** |

### Implied Valuation (Target: XXXX)

| Metric | Target Value | Peer Multiple | Implied Enterprise Val | Implied Share Price |
|---|---|---|---|---|
| EBITDA | R$ 10B | 5.6x | R$ 56B | R$ 25.40 |
| Earnings | R$ 4B | 9.3x | N/A | R$ 28.10 |

**Conclusion**: The target (Current Price: R$ 22.00) appears **Undervalued** based on peer multiples.
