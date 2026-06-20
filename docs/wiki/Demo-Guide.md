# Demo Guide

Use this flow to understand Mandate in a few minutes.

## 1. Create Mandate

The owner creates a capped Mandate that defines how much the agent can spend, where it can execute, and when the authority expires.

## 2. Run Test Agent

Run a single agent execution to show that the owner does not need to sign the trade again.

## 3. Enable Force Execution

Force Execution bypasses the signal threshold only, so the demo can trigger the agent path while policy checks still apply.

## 4. Observe Execution Or Block

If the action is within policy, the agent submits a DeepBook execution. If it exceeds the policy, Mandate records a blocked action instead.

## 5. Revoke Mandate -> Funds Return

The owner revokes the Mandate, remaining funds return to the owner wallet, and later agent attempts are blocked by policy.

## Proof To Check

- Activity Log shows created, executed, blocked, revoked, and withdrawn events.
- DeepBook Orders shows real swap records linked to the Mandate.
- The owner signs to create or revoke, not for every agent action.
