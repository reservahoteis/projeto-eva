# Cross-Border Data Transfer Documentation (MED-005)

**LGPD Article 33** — International data transfers require one of:
adequacy decision, standard contractual clauses, or data subject consent.

## Third-Party Data Processors

| Provider | Data Processed | Residency | DPA Status |
|----------|---------------|-----------|------------|
| Meta (WhatsApp Cloud API) | Messages, phone numbers, profile names | US (Meta servers) | TODO: Execute DPA |
| Meta (Instagram Messaging) | DMs, profile names, media | US (Meta servers) | TODO: Execute DPA |
| Meta (Messenger Platform) | Messages, profile names | US (Meta servers) | TODO: Execute DPA |
| Stripe | Payment data, customer IDs | US (Stripe servers) | TODO: Execute DPA |
| Hostinger (VPS) | All application data | Brazil (72.61.39.235) | Hosting in BR |
| Vercel (Frontend) | Static assets, no PII at rest | US/Global CDN | No PII stored |
| Redis (in-container) | Session cache, message queues | Brazil (same VPS) | Co-located |
| PostgreSQL (in-container) | All PII, messages, contacts | Brazil (same VPS) | Co-located |

## Data Flow Analysis

### Inbound Messages
```
User (Brazil) -> WhatsApp/IG/Messenger (Meta US servers) -> Webhook -> VPS (Brazil)
```
Message content transits through Meta's US infrastructure before arriving
at our Brazil-hosted VPS. This constitutes cross-border data transfer.

### Outbound Messages
```
VPS (Brazil) -> Meta Graph API (US servers) -> WhatsApp/IG/Messenger -> User (Brazil)
```
Message content is sent from our Brazil server to Meta's US API, which then
delivers it to the recipient. This also constitutes cross-border transfer.

## Required Actions

### 1. Data Processing Agreements (DPAs)
- [ ] Execute Meta Platform Terms DPA (covers WhatsApp, Instagram, Messenger)
- [ ] Execute Stripe DPA (https://stripe.com/legal/dpa)
- [ ] Review Hostinger DPA (hosting within Brazil — lower risk)

### 2. Privacy Policy Updates
- [ ] Disclose that message content is processed by Meta (US-based)
- [ ] Disclose Stripe as payment processor
- [ ] State legal basis for cross-border transfer (consent or legitimate interest)

### 3. Technical Safeguards
- [x] Tokens encrypted at rest (Fernet AES-128-CBC)
- [x] HMAC-SHA256 webhook signature validation
- [x] TLS in transit (HTTPS for all API calls)
- [x] PII sanitized from application logs
- [ ] Consider message content encryption at rest in PostgreSQL

### 4. Data Subject Rights
- [x] Right to access: `/api/v1/lgpd/contacts/{id}/export`
- [x] Right to erasure: `/api/v1/lgpd/contacts/{id}/erase`
- [x] Consent management: grant/revoke endpoints
- [x] Data retention: configurable per-tenant, automated cleanup

## Legal Basis for Transfer

Under LGPD Article 33, the most applicable basis for this system is:

**Article 33, VIII — Consent**: Data subjects implicitly consent to
cross-border transfer when they initiate communication via WhatsApp,
Instagram, or Messenger, as these platforms are operated by Meta (US-based).
The privacy policy should explicitly state this.

**Article 33, II — Contractual clauses**: DPAs with Meta and Stripe
provide additional legal grounding.

## Review Schedule
- Quarterly review of data processor list
- Annual DPA renewal verification
- Privacy policy update on any processor change
