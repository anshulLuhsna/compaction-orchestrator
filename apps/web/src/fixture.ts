export const supportFixture = {
  name: "customer-support-refund-escalation-demo",
  objective: "Prepare a reliable handoff package for the next support agent handling this billing/refund ticket.",
  desiredBudget: 1600,
  policy: {
    mode: "balanced",
    preserveUserMessagesVerbatim: true,
    preserveActiveErrorsVerbatim: false,
    allowExternalRetrieval: true
  },
  events: [
    {
      role: "system",
      type: "message",
      content: "Support policy: For Enterprise annual customers, do not promise refunds above $5,000 without Billing Ops approval. Preserve customer commitments and escalation reasons exactly.",
      metadata: { useCase: "customer_support", semanticType: "support_policy" }
    },
    {
      role: "user",
      type: "message",
      content: "Customer: Maya Chen, email maya.chen@example.com, account ACME-ENT-4481, Enterprise annual plan, region EU. She says her team was double charged for invoice INV-2026-0441 and cannot access the admin billing page.",
      metadata: {
        useCase: "customer_support",
        semanticType: "customer_profile",
        customer: {
          name: "Maya Chen",
          email: "maya.chen@example.com",
          accountId: "ACME-ENT-4481",
          plan: "Enterprise annual",
          region: "EU"
        },
        issue: {
          summary: "Enterprise customer double charged on invoice INV-2026-0441 and blocked from admin billing page.",
          productArea: "Billing",
          severity: "high",
          status: "open"
        }
      }
    },
    {
      role: "assistant",
      type: "message",
      content: "I acknowledged the issue and told the customer I would investigate invoice INV-2026-0441 and the billing page access problem. I did not promise a refund.",
      metadata: { useCase: "customer_support", semanticType: "troubleshooting_step" }
    },
    {
      role: "tool",
      type: "tool_output",
      content: "Billing lookup for account ACME-ENT-4481:\n- Invoice INV-2026-0441: $12,400 paid on 2026-06-12\n- Invoice INV-2026-0441-DUP: $12,400 paid on 2026-06-12\n- Duplicate charge detected by Stripe event evt_dup_7781\n- Refund amount exceeds $5,000 approval threshold\n- Admin billing page returns 403 for owner role due to entitlement flag billing_portal_v2=false\nAdditional repeated audit rows:\nrow 001 duplicate audit detail\nrow 002 duplicate audit detail\nrow 003 duplicate audit detail\nrow 004 duplicate audit detail\nrow 005 duplicate audit detail\nrow 006 duplicate audit detail\nrow 007 duplicate audit detail\nrow 008 duplicate audit detail\nrow 009 duplicate audit detail\nrow 010 duplicate audit detail\nrow 011 duplicate audit detail\nrow 012 duplicate audit detail\nrow 013 duplicate audit detail\nrow 014 duplicate audit detail\nrow 015 duplicate audit detail\nrow 016 duplicate audit detail\nrow 017 duplicate audit detail\nrow 018 duplicate audit detail\nrow 019 duplicate audit detail\nrow 020 duplicate audit detail",
      metadata: {
        useCase: "customer_support",
        semanticType: "troubleshooting_step",
        command: "billing.lookup",
        artifacts: ["billing-ledger/ACME-ENT-4481.json"]
      }
    },
    {
      role: "assistant",
      type: "decision",
      content: "Decision: Do not offer an immediate refund because the duplicate charge is $12,400 and requires Billing Ops approval under the refund policy. Escalate with invoice IDs, Stripe event, and entitlement flag evidence.",
      metadata: { useCase: "customer_support", semanticType: "decision" }
    },
    {
      role: "tool",
      type: "tool_output",
      content: "Entitlement check failed for billing portal:\nError: entitlement flag billing_portal_v2=false for account ACME-ENT-4481\nat BillingPortalAccess.checkEntitlement (billing/access.ts:84)\nat BillingPortalAccess.authorize (billing/access.ts:41)\nResult: owner role receives 403 on /admin/billing\nSuggested remediation: enable billing_portal_v2 after Billing Ops confirms duplicate invoice handling.",
      metadata: {
        useCase: "customer_support",
        semanticType: "troubleshooting_step",
        command: "entitlements.check",
        artifacts: ["billing/access.ts"]
      }
    },
    {
      role: "assistant",
      type: "message",
      content: "Escalation required: Billing Ops must approve or process the duplicate charge refund because the amount is $12,400. Target team: Billing Ops. Reason: refund exceeds approval threshold and billing portal entitlement is disabled.",
      metadata: {
        useCase: "customer_support",
        semanticType: "escalation_state",
        escalation: {
          required: true,
          targetTeam: "Billing Ops",
          reason: "Duplicate charge refund is $12,400 and exceeds approval threshold; billing portal entitlement is disabled."
        },
        issue: { status: "escalated" }
      }
    },
    {
      role: "assistant",
      type: "message",
      content: "Next action: Reply to Maya with a transparent status update, confirm no refund has been promised yet, explain Billing Ops approval is required, and ask whether she can wait for a same-day update by 5 PM UTC.",
      metadata: { useCase: "customer_support", semanticType: "next_action" }
    }
  ],
  expectedFacts: [
    { id: "customer_name", category: "customer", requiredTerms: ["Maya Chen"] },
    { id: "account_id", category: "customer", requiredTerms: ["ACME-ENT-4481"] },
    { id: "policy_constraint", category: "instruction", requiredTerms: ["$5,000", "Billing Ops approval"] },
    { id: "duplicate_invoice", category: "exact_fact", requiredTerms: ["INV-2026-0441", "INV-2026-0441-DUP"] },
    { id: "error_state", category: "active_state", requiredTerms: ["billing_portal_v2=false", "403"] },
    { id: "next_action", category: "next_action", requiredTerms: ["no refund", "same-day update", "5 PM UTC"] }
  ]
} as const;

export const codingFixture = {
  name: "coding-agent-router-debug-demo",
  objective: "Prepare compact context for the next coding-agent turn while preserving active build failure, user constraints, and the implementation decision.",
  desiredBudget: 1200,
  policy: {
    mode: "balanced",
    preserveUserMessagesVerbatim: true,
    preserveActiveErrorsVerbatim: false,
    allowExternalRetrieval: true
  },
  events: [
    {
      role: "user",
      type: "message",
      content: "Implement the billing router in apps/api/src/billing-router.ts. Use Hono only. Do not add Express. Keep the public response shape exactly { ok, invoiceId, status }. Add the route under /v1/billing/:invoiceId.",
      metadata: { artifacts: ["apps/api/src/billing-router.ts"] }
    },
    {
      role: "assistant",
      type: "message",
      content: "I inspected apps/api/src/index.ts and packages/core/src/store.ts. The API already uses Hono and centralizes route registration in apps/api/src/index.ts. There is no Express dependency.",
      metadata: { artifacts: ["apps/api/src/index.ts", "packages/core/src/store.ts"] }
    },
    {
      role: "tool",
      type: "tool_output",
      content: "rg billing apps packages\napps/api/src/index.ts: app.get('/v1/sessions/:sessionId/context', ...)\napps/api/src/openai.ts: export function getOpenAIConfig()\npackages/core/src/context-package.ts: productArea: 'Billing'\nNo billing router exists yet.\nAdditional low-value search output:\nline 001 repeated unrelated context\nline 002 repeated unrelated context\nline 003 repeated unrelated context\nline 004 repeated unrelated context\nline 005 repeated unrelated context\nline 006 repeated unrelated context\nline 007 repeated unrelated context\nline 008 repeated unrelated context\nline 009 repeated unrelated context\nline 010 repeated unrelated context\nline 011 repeated unrelated context\nline 012 repeated unrelated context\nline 013 repeated unrelated context\nline 014 repeated unrelated context\nline 015 repeated unrelated context\nline 016 repeated unrelated context\nline 017 repeated unrelated context\nline 018 repeated unrelated context\nline 019 repeated unrelated context\nline 020 repeated unrelated context\nline 021 repeated unrelated context\nline 022 repeated unrelated context\nline 023 repeated unrelated context\nline 024 repeated unrelated context\nline 025 repeated unrelated context\nline 026 repeated unrelated context\nline 027 repeated unrelated context\nline 028 repeated unrelated context\nline 029 repeated unrelated context\nline 030 repeated unrelated context",
      metadata: {
        command: "rg billing apps packages",
        artifacts: ["apps/api/src/index.ts", "packages/core/src/context-package.ts"]
      }
    },
    {
      role: "assistant",
      type: "decision",
      content: "Decision: create a small Hono router module and mount it from apps/api/src/index.ts instead of putting billing logic inline. Preserve the response shape { ok, invoiceId, status } and keep invoice status deterministic for the demo.",
      metadata: { artifacts: ["apps/api/src/billing-router.ts", "apps/api/src/index.ts"] }
    },
    {
      role: "tool",
      type: "tool_output",
      content: "npm run typecheck failed\n\napps/api/src/billing-router.ts:2:22 - error TS2307: Cannot find module './billing-store.js' or its corresponding type declarations.\n\n2 import { lookupInvoice } from './billing-store.js';\n                       ~~~~~~~~~~~~~~~~~~~~\n\napps/api/src/index.ts:17:10 - error TS2305: Module './billing-router.js' has no exported member 'billingRouter'.\n\n17 import { billingRouter } from './billing-router.js';\n            ~~~~~~~~~~~~~\n\nNeed to either add apps/api/src/billing-store.ts or inline the lookup in billing-router.ts, and export billingRouter by name.",
      metadata: {
        command: "npm run typecheck",
        artifacts: ["apps/api/src/billing-router.ts", "apps/api/src/index.ts"]
      }
    },
    {
      role: "assistant",
      type: "message",
      content: "Next action: fix the missing billing-store import by keeping the invoice lookup local to billing-router.ts, export const billingRouter, then rerun npm run typecheck and npm run test:smoke.",
      metadata: { artifacts: ["apps/api/src/billing-router.ts"] }
    }
  ],
  expectedFacts: [
    { id: "framework_constraint", category: "instruction", requiredTerms: ["Use Hono only", "Do not add Express"] },
    { id: "response_shape", category: "exact_fact", requiredTerms: ["{ ok, invoiceId, status }"] },
    { id: "route_path", category: "exact_fact", requiredTerms: ["/v1/billing/:invoiceId"] },
    { id: "active_error", category: "active_state", requiredTerms: ["Cannot find module './billing-store.js'", "no exported member 'billingRouter'"] },
    { id: "next_action", category: "next_action", requiredTerms: ["export const billingRouter", "npm run typecheck", "npm run test:smoke"] }
  ]
} as const;
