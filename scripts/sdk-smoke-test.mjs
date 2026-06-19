import assert from "node:assert/strict";
import { compact, compactCustomerSupport, messagesToEvents } from "../packages/core/dist/index.js";

const generic = compact({
  messages: [
    {
      role: "user",
      content: "Always preserve the customer refund constraint exactly."
    },
    {
      role: "tool",
      content: "Command failed\nError: Cannot find module './billing-policy'\nRepeated stack noise\nRepeated stack noise"
    }
  ],
  objective: "Continue the agent session with the important state intact.",
  policy: {
    preserveActiveErrorsVerbatim: false
  }
});

assert.equal(generic.segments.length, 2);
assert.equal(generic.plan.segments[0]?.operation, "keep_verbatim");
assert.equal(generic.plan.segments[1]?.operation, "extract_active_error");
assert.match(generic.contextView.content, /refund constraint/i);
assert.match(generic.contextView.content, /Cannot find module/);

const support = compactCustomerSupport({
  messages: [
    {
      role: "system",
      content: "Support policy: Do not promise refunds above $5,000 without Billing Ops approval.",
      metadata: {
        semanticType: "support_policy"
      }
    },
    {
      role: "user",
      content: "Customer: Maya Chen, account ACME-ENT-4481. She was double charged and cannot access billing.",
      metadata: {
        semanticType: "customer_profile",
        customer: {
          name: "Maya Chen",
          accountId: "ACME-ENT-4481"
        },
        issue: {
          summary: "Double charged and blocked from billing.",
          productArea: "Billing",
          severity: "high",
          status: "open"
        }
      }
    },
    {
      role: "tool",
      content: "Error: billing_portal_v2=false for account ACME-ENT-4481. Owner gets 403.",
      metadata: {
        semanticType: "troubleshooting_step"
      }
    },
    {
      role: "assistant",
      content: "Escalation required: Billing Ops must approve the refund.",
      metadata: {
        semanticType: "escalation_state",
        escalation: {
          required: true,
          targetTeam: "Billing Ops",
          reason: "Refund exceeds approval threshold."
        },
        issue: {
          status: "escalated"
        }
      }
    },
    {
      role: "assistant",
      content: "Next action: reply with status and do not promise the refund yet.",
      metadata: {
        semanticType: "next_action"
      }
    }
  ],
  objective: "Prepare support handoff."
});

assert.equal(support.contextPackage.customer.name, "Maya Chen");
assert.equal(support.contextPackage.customer.accountId, "ACME-ENT-4481");
assert.equal(support.contextPackage.issue.status, "escalated");
assert.equal(support.contextPackage.escalation.required, true);
assert.equal(support.contextPackage.escalation.targetTeam, "Billing Ops");
assert.match(support.contextPackage.runtimeContext.content, /billing_portal_v2=false/);
assert.match(support.contextPackage.nextActions.join("\n"), /do not promise/i);

const events = messagesToEvents([
  {
    role: "assistant",
    content: "Next action: send the handoff.",
    metadata: {
      semanticType: "next_action"
    }
  }
], {
  sessionId: "ses_test",
  useCase: "customer_support"
});

assert.equal(events[0]?.sessionId, "ses_test");
assert.equal(events[0]?.sequence, 1);
assert.equal(events[0]?.metadata.useCase, "customer_support");
assert.equal(events[0]?.type, "message");

console.log(JSON.stringify({
  ok: true,
  genericOperations: generic.plan.segments.map((segment) => segment.operation),
  supportOperations: support.contextPackage.compactionPlan.segments.map((segment) => segment.operation),
  supportIssue: support.contextPackage.issue
}, null, 2));
