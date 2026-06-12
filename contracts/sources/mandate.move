/// Mandate is a policy-based autonomous wallet control object for AI agents.
/// The MVP enforces owner-defined budget, protocol, expiry, and revocation
/// rules before a mocked DeepBook order can be recorded on-chain.
module mandate::mandate;

use sui::clock::{Self, Clock};
use sui::coin::{Self, Coin};
use sui::event;
use sui::object::{Self, ID, UID};
use sui::transfer;
use sui::tx_context::{Self, TxContext};

/// Sender is not the mandate owner.
const E_NOT_OWNER: u64 = 1;
/// Sender is not the authorized agent.
const E_NOT_AGENT: u64 = 2;
/// Mandate has been revoked or deactivated.
const E_REVOKED: u64 = 3;
/// Mandate has expired.
const E_EXPIRED: u64 = 4;
/// Requested protocol is outside the mandate scope.
const E_PROTOCOL_NOT_ALLOWED: u64 = 5;
/// Requested amount exceeds the per-transaction limit.
const E_SINGLE_TX_LIMIT_EXCEEDED: u64 = 6;
/// Requested amount exceeds the remaining mandate budget.
const E_BUDGET_EXCEEDED: u64 = 7;
/// TTL must be greater than zero.
const E_INVALID_TTL: u64 = 8;
/// Budget ceiling and single-transaction limit must be valid.
const E_INVALID_BUDGET: u64 = 9;

/// MVP protocol scope: only DeepBook is allowed.
const PROTOCOL_DEEPBOOK: u8 = 1;

/// Human-readable action tag for the mocked DeepBook order path.
const ACTION_DEEPBOOK_ORDER_MOCK: vector<u8> = b"deepbook_order_mock";
/// Human-readable action tag for a real coin-backed DeepBook PTB authorization.
const ACTION_DEEPBOOK_SPEND_AUTHORIZED: vector<u8> = b"deepbook_spend_authorized";

/// Core owner-controlled mandate object.
public struct Mandate has key {
    id: UID,
    owner: address,
    agent: address,
    budget_ceiling: u64,
    current_spent: u64,
    max_single_tx: u64,
    protocol_scope: u8,
    expires_at_ms: u64,
    is_active: bool,
    created_at_ms: u64,
}

/// Emitted when an owner creates a mandate.
public struct CreatedEvent has copy, drop {
    mandate_id: ID,
    owner: address,
    agent: address,
    budget_ceiling: u64,
    max_single_tx: u64,
    protocol: u8,
    created_at_ms: u64,
    expires_at_ms: u64,
}

/// Emitted when an authorized agent successfully records an activity.
public struct ActivityEvent has copy, drop {
    mandate_id: ID,
    agent: address,
    action: vector<u8>,
    amount: u64,
    protocol: u8,
    timestamp_ms: u64,
    success: bool,
}

/// Emitted when the owner revokes a mandate.
public struct RevokeEvent has copy, drop {
    mandate_id: ID,
    owner: address,
    timestamp_ms: u64,
}

/// Reserved for a future non-aborting try-execute path.
/// Abort-based rejection rolls back events in the rejected transaction.
#[allow(unused_field)]
public struct RejectEvent has copy, drop {
    mandate_id: ID,
    agent: address,
    reason: vector<u8>,
    amount: u64,
    timestamp_ms: u64,
}

/// Emitted when the backend agent records a policy-blocked attempt.
///
/// This path does not execute DeepBook and does not mutate mandate spend. It is
/// used by PTBs that need an on-chain audit trail for blocked demo strategies.
public struct BlockedEvent has copy, drop {
    mandate_id: ID,
    owner: address,
    agent: address,
    attempted_amount: u64,
    reason: vector<u8>,
    timestamp_ms: u64,
}

/// Returns the MVP DeepBook protocol constant for clients and tests.
public fun deepbook_protocol(): u8 {
    PROTOCOL_DEEPBOOK
}

/// Returns the mandate owner.
public fun owner(mandate: &Mandate): address {
    mandate.owner
}

/// Returns the authorized agent address.
public fun agent(mandate: &Mandate): address {
    mandate.agent
}

/// Returns the total amount already spent under this mandate.
public fun current_spent(mandate: &Mandate): u64 {
    mandate.current_spent
}

/// Returns whether the mandate is currently active.
public fun is_active(mandate: &Mandate): bool {
    mandate.is_active
}

/// Returns the mandate expiry timestamp in milliseconds.
public fun expires_at_ms(mandate: &Mandate): u64 {
    mandate.expires_at_ms
}

/// Creates a new shared mandate object.
///
/// The owner is always the transaction sender. The mandate starts active,
/// with zero spend, expires after `ttl_ms` from the supplied Sui Clock, and
/// is shared so the authorized agent can execute autonomously.
entry fun create_mandate(
    agent: address,
    budget_ceiling: u64,
    max_single_tx: u64,
    protocol_scope: u8,
    ttl_ms: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(ttl_ms > 0, E_INVALID_TTL);
    assert!(
        budget_ceiling > 0 && max_single_tx > 0 && max_single_tx <= budget_ceiling,
        E_INVALID_BUDGET,
    );
    assert!(protocol_scope == PROTOCOL_DEEPBOOK, E_PROTOCOL_NOT_ALLOWED);

    let owner = tx_context::sender(ctx);
    let created_at_ms = clock::timestamp_ms(clock);
    let expires_at_ms = created_at_ms + ttl_ms;
    let mandate = Mandate {
        id: object::new(ctx),
        owner,
        agent,
        budget_ceiling,
        current_spent: 0,
        max_single_tx,
        protocol_scope,
        expires_at_ms,
        is_active: true,
        created_at_ms,
    };
    let mandate_id = object::id(&mandate);

    event::emit(CreatedEvent {
        mandate_id,
        owner,
        agent,
        budget_ceiling,
        max_single_tx,
        protocol: protocol_scope,
        created_at_ms,
        expires_at_ms,
    });

    transfer::share_object(mandate);
}

/// Mock DeepBook execution path for the MVP.
///
/// This does not touch real DeepBook pools yet. It enforces the mandate policy,
/// increments spend on success, and emits an on-chain activity event.
#[allow(unused_mut_parameter)]
entry fun execute_deepbook_order_mock(
    mandate: &mut Mandate,
    amount: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let sender = tx_context::sender(ctx);
    let timestamp_ms = clock::timestamp_ms(clock);

    assert!(sender == mandate.agent, E_NOT_AGENT);
    assert!(mandate.is_active, E_REVOKED);
    assert!(timestamp_ms <= mandate.expires_at_ms, E_EXPIRED);
    assert!(mandate.protocol_scope == PROTOCOL_DEEPBOOK, E_PROTOCOL_NOT_ALLOWED);
    assert!(amount <= mandate.max_single_tx, E_SINGLE_TX_LIMIT_EXCEEDED);
    assert!(amount <= mandate.budget_ceiling - mandate.current_spent, E_BUDGET_EXCEEDED);

    mandate.current_spent = mandate.current_spent + amount;

    event::emit(ActivityEvent {
        mandate_id: object::id(mandate),
        agent: sender,
        action: ACTION_DEEPBOOK_ORDER_MOCK,
        amount,
        protocol: PROTOCOL_DEEPBOOK,
        timestamp_ms,
        success: true,
    });
}

/// Authorizes a real coin-backed DeepBook spend inside a PTB.
///
/// This function does not call DeepBook directly. It reads the exact value from
/// `input_coin`, enforces the mandate policy, records spend, and emits an
/// activity event. The same PTB can then pass `input_coin` into DeepBook.
#[allow(unused_mut_parameter)]
entry fun authorize_deepbook_spend_with_coin<T>(
    mandate: &mut Mandate,
    input_coin: &Coin<T>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let sender = tx_context::sender(ctx);
    let timestamp_ms = clock::timestamp_ms(clock);
    let amount = coin::value(input_coin);

    assert!(sender == mandate.agent, E_NOT_AGENT);
    assert!(mandate.is_active, E_REVOKED);
    assert!(timestamp_ms <= mandate.expires_at_ms, E_EXPIRED);
    assert!(mandate.protocol_scope == PROTOCOL_DEEPBOOK, E_PROTOCOL_NOT_ALLOWED);
    assert!(amount <= mandate.max_single_tx, E_SINGLE_TX_LIMIT_EXCEEDED);
    assert!(amount <= mandate.budget_ceiling - mandate.current_spent, E_BUDGET_EXCEEDED);

    mandate.current_spent = mandate.current_spent + amount;

    event::emit(ActivityEvent {
        mandate_id: object::id(mandate),
        agent: sender,
        action: ACTION_DEEPBOOK_SPEND_AUTHORIZED,
        amount,
        protocol: PROTOCOL_DEEPBOOK,
        timestamp_ms,
        success: true,
    });
}

/// Records a blocked agent action without consuming budget.
///
/// Only the authorized agent can emit this event. The function intentionally
/// does not enforce active/expiry/budget checks because it records those policy
/// failures before any DeepBook submission is attempted.
entry fun record_blocked_action(
    mandate: &Mandate,
    attempted_amount: u64,
    reason: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let sender = tx_context::sender(ctx);
    assert!(sender == mandate.agent, E_NOT_AGENT);

    event::emit(BlockedEvent {
        mandate_id: object::id(mandate),
        owner: mandate.owner,
        agent: sender,
        attempted_amount,
        reason,
        timestamp_ms: clock::timestamp_ms(clock),
    });
}

/// Revokes an active mandate.
///
/// Only the owner can revoke. Once revoked, agent execution aborts with
/// `E_REVOKED`.
#[allow(unused_mut_parameter)]
entry fun revoke_mandate(
    mandate: &mut Mandate,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let sender = tx_context::sender(ctx);
    assert!(sender == mandate.owner, E_NOT_OWNER);

    mandate.is_active = false;

    event::emit(RevokeEvent {
        mandate_id: object::id(mandate),
        owner: sender,
        timestamp_ms: clock::timestamp_ms(clock),
    });
}
