#!/usr/bin/env python3
import json
import sys
from datetime import datetime

import yfinance as yf
import requests
import pandas as pd


def _json_default(value):
  if isinstance(value, (datetime, )):
    return value.isoformat()
  return str(value)


def respond(ok, data=None, error=None):
  payload = {"ok": ok}
  if ok:
    payload["data"] = data
    payload["source"] = "yfinance/yahoo"
  else:
    payload["error"] = error or "unknown error"
  sys.stdout.write(json.dumps(payload, default=_json_default))


def df_to_records(df):
  if df is None or df.empty:
    return []
  df = df.copy()
  columns = []
  for col in df.columns:
    if hasattr(col, "date"):
      try:
        columns.append(col.date().isoformat())
      except Exception:
        columns.append(str(col))
    else:
      columns.append(str(col))
  df.columns = columns
  df = df.transpose()
  records = []
  for idx, row in df.iterrows():
    rec = {"report_period": str(idx)}
    for key, val in row.items():
      if pd.isna(val):
        continue
      if isinstance(val, float) or isinstance(val, int):
        rec[str(key)] = float(val)
      else:
        rec[str(key)] = val
    records.append(rec)
  return records


def normalize_history(df):
  if df is None or df.empty:
    return []
  df = df.reset_index()
  records = []
  for _, row in df.iterrows():
    date_value = row.get("Date") or row.get("Datetime")
    if hasattr(date_value, "to_pydatetime"):
      date_value = date_value.to_pydatetime().isoformat()
    elif hasattr(date_value, "isoformat"):
      date_value = date_value.isoformat()
    record = {
      "date": date_value,
      "open": float(row.get("Open")) if row.get("Open") is not None else None,
      "high": float(row.get("High")) if row.get("High") is not None else None,
      "low": float(row.get("Low")) if row.get("Low") is not None else None,
      "close": float(row.get("Close")) if row.get("Close") is not None else None,
      "volume": float(row.get("Volume")) if row.get("Volume") is not None else None,
    }
    records.append(record)
  return records


def handle_search(query):
  url = "https://query1.finance.yahoo.com/v1/finance/search"
  resp = requests.get(url, params={"q": query, "lang": "en-US", "region": "US"})
  resp.raise_for_status()
  return resp.json()


def handle_history(symbol, start_date, end_date, interval):
  interval_map = {
    "minute": "1m",
    "day": "1d",
    "week": "1wk",
    "month": "1mo",
    "year": "1y",
  }
  yf_interval = interval_map.get(interval, interval)
  ticker = yf.Ticker(symbol)
  df = ticker.history(start=start_date, end=end_date, interval=yf_interval)
  return normalize_history(df)


def handle_news(symbol):
  ticker = yf.Ticker(symbol)
  return ticker.news


def handle_estimates(symbol):
  ticker = yf.Ticker(symbol)
  info = ticker.info or {}
  data = {
    "info": {
      "targetMeanPrice": info.get("targetMeanPrice"),
      "targetHighPrice": info.get("targetHighPrice"),
      "targetLowPrice": info.get("targetLowPrice"),
      "recommendationMean": info.get("recommendationMean"),
      "recommendationKey": info.get("recommendationKey"),
      "numberOfAnalystOpinions": info.get("numberOfAnalystOpinions"),
      "forwardEps": info.get("forwardEps"),
      "trailingEps": info.get("trailingEps"),
    }
  }
  return data


def handle_info(symbol):
  ticker = yf.Ticker(symbol)
  return ticker.info or {}


def handle_statements(symbol, statement_type):
  ticker = yf.Ticker(symbol)
  if statement_type == "income":
    annual = ticker.financials
    quarterly = ticker.quarterly_financials
  elif statement_type == "balance":
    annual = ticker.balance_sheet
    quarterly = ticker.quarterly_balance_sheet
  else:
    annual = ticker.cashflow
    quarterly = ticker.quarterly_cashflow
  return {"annual": df_to_records(annual), "quarterly": df_to_records(quarterly)}


def main():
  try:
    payload = json.loads(sys.stdin.read() or "{}")
    action = payload.get("action")

    if action == "search":
      query = payload.get("query")
      respond(True, handle_search(query))
      return
    if action == "history":
      respond(True, handle_history(payload.get("symbol"), payload.get("start_date"), payload.get("end_date"), payload.get("interval")))
      return
    if action == "news":
      respond(True, handle_news(payload.get("symbol")))
      return
    if action == "estimates":
      respond(True, handle_estimates(payload.get("symbol")))
      return
    if action == "info":
      respond(True, handle_info(payload.get("symbol")))
      return
    if action == "statements":
      respond(True, handle_statements(payload.get("symbol"), payload.get("statement_type")))
      return

    respond(False, error="Unsupported action")
  except Exception as exc:
    respond(False, error=str(exc))


if __name__ == "__main__":
  main()
