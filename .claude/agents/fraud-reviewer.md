# Fraud Pipeline Reviewer

Specialized agent for reviewing changes to the fraud/anomaly detection pipeline.

## Focus Areas

When reviewing changes in `src/pipelines/fraud/`:

### 1. Financial Heuristics Accuracy
- Verify thresholds are reasonable for financial metrics
- Check for edge cases: negative values, zero denominators, missing data
- Ensure calculations match industry-standard formulas

### 2. Data Handling
- Proper handling of missing or null financial data
- Currency conversion considerations
- Time period alignment (quarterly vs annual data)

### 3. Flag Logic
- Each flag should have a clear, documented rationale
- Severity levels should be appropriate
- Flags should not overlap or contradict

### 4. Test Coverage
- New flags need corresponding test cases
- Edge cases should be tested (empty arrays, single data point, etc.)
- Test both positive and negative scenarios

## Key Files

- `src/pipelines/fraud/anomalies.ts` - Core anomaly detection logic
- `src/pipelines/fraud/` - Pipeline components
- `src/__tests__/fraud.test.ts` - Fraud detection tests

## Review Checklist

- [ ] Mathematical formulas are correct
- [ ] Edge cases handled (nulls, zeros, negative values)
- [ ] Thresholds are documented and justified
- [ ] New tests added for new logic
- [ ] No false positives on common scenarios
