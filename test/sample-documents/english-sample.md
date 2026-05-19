<div class="cover-page">
  <h1>Acme Analytics Platform</h1>
  <p class="document-subtitle">Investment Memorandum &mdash; Confidential</p>
  <p><span class="status-badge is-draft">Draft</span></p>
  <p>Prepared for the Board of Directors</p>
</div>

<div class="document-header">
  <h1>Executive Summary</h1>
  <p class="document-subtitle">A concise overview of the opportunity, the ask, and the expected return.</p>
</div>

Acme Analytics is raising a Series A round to expand its data platform into
three new markets. This memorandum summarises the business case, financial
projections, and the proposed terms of the investment.

## Opportunity

The market for self-service analytics tooling continues to grow as teams move
reporting in-house. Acme's product reduces the time to a production dashboard
from **weeks to hours**, and the company has reached profitability on its
current customer base.

Key reasons to invest:

1. Profitable, growing revenue base
2. Low customer churn across two consecutive years
3. A defensible product built on proprietary ingestion technology
4. An experienced founding team

<div class="note-box">
  <strong>Note:</strong> All figures in this memorandum are unaudited and
  reflect management's current estimates. Final terms are subject to
  completion of due diligence.
</div>

## Financial Snapshot

| Metric                | FY2023        | FY2024        | FY2025 (Proj.) |
| --------------------- | ------------- | ------------- | -------------- |
| Annual Recurring Rev. | <span class="number">1,200,000</span> | <span class="number">2,150,000</span> | <span class="number">3,800,000</span> |
| Gross Margin          | 78%           | 81%           | 83%            |
| Net Revenue Retention | 112%          | 118%          | 120%           |
| Headcount             | 14            | 22            | 35             |

<div class="highlight-box">
  The proposed round is <span class="price">$6,000,000 USD</span> at a
  pre-money valuation of <span class="price">$24,000,000 USD</span>.
</div>

## Use of Funds

The capital will be allocated across product, go-to-market, and operations:

- **Product & Engineering** — expand the ingestion and modelling teams
- **Go-to-Market** — build a repeatable outbound sales motion
- **Operations** — finance, compliance, and customer success

> "We are not buying growth; we are funding a system that already works and
> simply needs more reach." — CEO, Acme Analytics

## Technical Architecture

The platform exposes a small command-line client used during onboarding:

```bash
acme connect --source postgres://reports.internal
acme model build --target dashboards/revenue
acme publish --channel board
```

Inline configuration values such as `ACME_REGION` and `--target` are validated
before any job is queued.

<div class="page-break"></div>

## Proposed Terms

<div class="keep-together">

| Term            | Detail                                  |
| --------------- | --------------------------------------- |
| Instrument      | Preferred equity                        |
| Round size      | <span class="price">$6,000,000 USD</span> |
| Pre-money       | <span class="price">$24,000,000 USD</span> |
| Liquidation     | 1x non-participating                    |
| Board           | One investor seat                       |

</div>

## Risks

No investment is without risk. The principal risks identified during
preparation of this memorandum are concentration in a small number of large
accounts, and dependence on cloud infrastructure pricing.

<div class="note-box">
  Mitigations for each risk are described in full in Appendix B of the data
  room. Investors are encouraged to review them before committing.
</div>

## Recommendation

Management recommends proceeding to a full due-diligence phase with a view to
closing the round within the current quarter.

<div class="signature-box">
  <div class="signature-item">Founder &amp; CEO</div>
  <div class="signature-item">Lead Investor</div>
  <div class="signature-item">Board Chair</div>
</div>
