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
