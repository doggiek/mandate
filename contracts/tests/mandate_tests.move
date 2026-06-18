#[test_only]
module mandate::mandate_tests;

use mandate::mandate::{Self, AssetMandate, Mandate};
use sui::clock::{Self, Clock};
use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::test_scenario::{Self, Scenario};

public struct TESTUSD has drop {}

const OWNER: address = @0xA;
const AGENT: address = @0xB;
const OTHER: address = @0xC;

/// Builds the test clock used by policy checks.
fun new_clock(scenario: &mut Scenario): Clock {
    clock::create_for_testing(test_scenario::ctx(scenario))
}

/// Creates the default demo mandate:
/// 100 budget, 20 max single transaction, DeepBook only, 24h expiry.
fun create_default_mandate(scenario: &mut Scenario, clock: &Clock) {
    let budget_coin = coin::mint_for_testing<SUI>(100, test_scenario::ctx(scenario));
    mandate::create_mandate(
        AGENT,
        budget_coin,
        20,
        mandate::deepbook_protocol(),
        86_400_000,
        clock,
        test_scenario::ctx(scenario),
    );
}

/// Creates a generic test-asset mandate. This proves Move policy is scoped by
/// vault coin type, not by a hardcoded token whitelist.
fun create_testusd_mandate(scenario: &mut Scenario, clock: &Clock) {
    let budget_coin = coin::mint_for_testing<TESTUSD>(1_000, test_scenario::ctx(scenario));
    mandate::create_mandate_with_coin<TESTUSD>(
        AGENT,
        budget_coin,
        100,
        mandate::deepbook_protocol(),
        86_400_000,
        clock,
        test_scenario::ctx(scenario),
    );
}

/// Owner can create a mandate and make it available as a shared object.
#[test]
fun owner_creates_mandate_success() {
    let mut scenario = test_scenario::begin(OWNER);
    let clock = new_clock(&mut scenario);

    create_default_mandate(&mut scenario, &clock);

    test_scenario::next_tx(&mut scenario, OWNER);
    let mandate = test_scenario::take_shared<Mandate>(&scenario);
    assert!(mandate::owner(&mandate) == OWNER, 0);
    assert!(mandate::agent(&mandate) == AGENT, 1);
    assert!(mandate::current_spent(&mandate) == 0, 2);
    assert!(mandate::is_active(&mandate), 3);
    assert!(mandate::vault_balance(&mandate) == 100, 4);
    test_scenario::return_shared(mandate);

    clock::destroy_for_testing(clock);
    test_scenario::end(scenario);
}

/// Authorized agent can execute a 20-unit mocked DeepBook order.
#[test]
fun agent_executes_twenty_success() {
    let mut scenario = test_scenario::begin(OWNER);
    let clock = new_clock(&mut scenario);

    create_default_mandate(&mut scenario, &clock);

    test_scenario::next_tx(&mut scenario, AGENT);
    let mut mandate = test_scenario::take_shared<Mandate>(&scenario);
    mandate::execute_deepbook_order_mock(&mut mandate, 20, &clock, test_scenario::ctx(&mut scenario));
    assert!(mandate::current_spent(&mandate) == 20, 0);
    test_scenario::return_shared(mandate);

    clock::destroy_for_testing(clock);
    test_scenario::end(scenario);
}

/// A non-authorized address cannot execute against the mandate.
#[test]
#[expected_failure(abort_code = 2)]
fun non_agent_execute_fails() {
    let mut scenario = test_scenario::begin(OWNER);
    let clock = new_clock(&mut scenario);

    create_default_mandate(&mut scenario, &clock);

    test_scenario::next_tx(&mut scenario, OTHER);
    let mut mandate = test_scenario::take_shared<Mandate>(&scenario);
    mandate::execute_deepbook_order_mock(&mut mandate, 20, &clock, test_scenario::ctx(&mut scenario));
    test_scenario::return_shared(mandate);
    clock::destroy_for_testing(clock);
    test_scenario::end(scenario);
}

/// A single mocked order cannot exceed the max single transaction amount.
#[test]
#[expected_failure(abort_code = 6)]
fun exceeds_single_tx_limit_fails() {
    let mut scenario = test_scenario::begin(OWNER);
    let clock = new_clock(&mut scenario);

    create_default_mandate(&mut scenario, &clock);

    test_scenario::next_tx(&mut scenario, AGENT);
    let mut mandate = test_scenario::take_shared<Mandate>(&scenario);
    mandate::execute_deepbook_order_mock(&mut mandate, 21, &clock, test_scenario::ctx(&mut scenario));
    test_scenario::return_shared(mandate);
    clock::destroy_for_testing(clock);
    test_scenario::end(scenario);
}

/// Cumulative spend cannot exceed the total budget ceiling.
#[test]
#[expected_failure(abort_code = 7)]
fun exceeds_budget_ceiling_fails() {
    let mut scenario = test_scenario::begin(OWNER);
    let clock = new_clock(&mut scenario);

    create_default_mandate(&mut scenario, &clock);

    test_scenario::next_tx(&mut scenario, AGENT);
    let mut mandate = test_scenario::take_shared<Mandate>(&scenario);
    mandate::execute_deepbook_order_mock(&mut mandate, 20, &clock, test_scenario::ctx(&mut scenario));
    mandate::execute_deepbook_order_mock(&mut mandate, 20, &clock, test_scenario::ctx(&mut scenario));
    mandate::execute_deepbook_order_mock(&mut mandate, 20, &clock, test_scenario::ctx(&mut scenario));
    mandate::execute_deepbook_order_mock(&mut mandate, 20, &clock, test_scenario::ctx(&mut scenario));
    mandate::execute_deepbook_order_mock(&mut mandate, 20, &clock, test_scenario::ctx(&mut scenario));
    mandate::execute_deepbook_order_mock(&mut mandate, 1, &clock, test_scenario::ctx(&mut scenario));
    test_scenario::return_shared(mandate);
    clock::destroy_for_testing(clock);
    test_scenario::end(scenario);
}

/// After owner revocation, the agent can no longer execute.
#[test]
#[expected_failure(abort_code = 3)]
fun revoked_mandate_execute_fails() {
    let mut scenario = test_scenario::begin(OWNER);
    let clock = new_clock(&mut scenario);

    create_default_mandate(&mut scenario, &clock);

    test_scenario::next_tx(&mut scenario, OWNER);
    let mut mandate = test_scenario::take_shared<Mandate>(&scenario);
    mandate::revoke_mandate(&mut mandate, &clock, test_scenario::ctx(&mut scenario));
    test_scenario::return_shared(mandate);

    test_scenario::next_tx(&mut scenario, AGENT);
    let mut mandate = test_scenario::take_shared<Mandate>(&scenario);
    mandate::execute_deepbook_order_mock(&mut mandate, 20, &clock, test_scenario::ctx(&mut scenario));
    test_scenario::return_shared(mandate);
    clock::destroy_for_testing(clock);
    test_scenario::end(scenario);
}

/// Expired mandates reject agent execution.
#[test]
#[expected_failure(abort_code = 4)]
fun expired_mandate_execute_fails() {
    let mut scenario = test_scenario::begin(OWNER);
    let mut clock = new_clock(&mut scenario);

    create_default_mandate(&mut scenario, &clock);
    clock::increment_for_testing(&mut clock, 86_400_001);

    test_scenario::next_tx(&mut scenario, AGENT);
    let mut mandate = test_scenario::take_shared<Mandate>(&scenario);
    mandate::execute_deepbook_order_mock(&mut mandate, 20, &clock, test_scenario::ctx(&mut scenario));
    test_scenario::return_shared(mandate);
    clock::destroy_for_testing(clock);
    test_scenario::end(scenario);
}

/// Authorized agent can take Owner-funded SUI from the mandate vault for DeepBook.
#[test]
fun agent_takes_vault_sui_success() {
    let mut scenario = test_scenario::begin(OWNER);
    let clock = new_clock(&mut scenario);

    create_default_mandate(&mut scenario, &clock);

    test_scenario::next_tx(&mut scenario, AGENT);
    let mut mandate = test_scenario::take_shared<Mandate>(&scenario);
    let coin = mandate::authorize_and_take_sui_for_deepbook(
        &mut mandate,
        20,
        &clock,
        test_scenario::ctx(&mut scenario),
    );
    assert!(mandate::current_spent(&mandate) == 20, 0);
    assert!(mandate::vault_balance(&mandate) == 80, 1);
    test_scenario::return_shared(mandate);
    coin::burn_for_testing(coin);

    clock::destroy_for_testing(clock);
    test_scenario::end(scenario);
}

/// A vault withdrawal above the mandate's max single transaction limit is rejected.
#[test]
#[expected_failure(abort_code = 6)]
fun vault_authorization_exceeds_single_tx_limit_fails() {
    let mut scenario = test_scenario::begin(OWNER);
    let clock = new_clock(&mut scenario);

    create_default_mandate(&mut scenario, &clock);

    test_scenario::next_tx(&mut scenario, AGENT);
    let mut mandate = test_scenario::take_shared<Mandate>(&scenario);
    let coin = mandate::authorize_and_take_sui_for_deepbook(
        &mut mandate,
        21,
        &clock,
        test_scenario::ctx(&mut scenario),
    );
    test_scenario::return_shared(mandate);
    coin::burn_for_testing(coin);
    clock::destroy_for_testing(clock);
    test_scenario::end(scenario);
}

/// Revoked mandates also reject vault-backed DeepBook authorization.
#[test]
#[expected_failure(abort_code = 3)]
fun revoked_mandate_vault_authorization_fails() {
    let mut scenario = test_scenario::begin(OWNER);
    let clock = new_clock(&mut scenario);

    create_default_mandate(&mut scenario, &clock);

    test_scenario::next_tx(&mut scenario, OWNER);
    let mut mandate = test_scenario::take_shared<Mandate>(&scenario);
    mandate::revoke_mandate(&mut mandate, &clock, test_scenario::ctx(&mut scenario));
    test_scenario::return_shared(mandate);

    test_scenario::next_tx(&mut scenario, AGENT);
    let mut mandate = test_scenario::take_shared<Mandate>(&scenario);
    let coin = mandate::authorize_and_take_sui_for_deepbook(
        &mut mandate,
        20,
        &clock,
        test_scenario::ctx(&mut scenario),
    );
    test_scenario::return_shared(mandate);
    coin::burn_for_testing(coin);
    clock::destroy_for_testing(clock);
    test_scenario::end(scenario);
}

/// Owner can recover remaining vault SUI after revoking the mandate.
#[test]
fun owner_withdraws_remaining_sui_after_revoke() {
    let mut scenario = test_scenario::begin(OWNER);
    let clock = new_clock(&mut scenario);

    create_default_mandate(&mut scenario, &clock);

    test_scenario::next_tx(&mut scenario, AGENT);
    let mut mandate = test_scenario::take_shared<Mandate>(&scenario);
    let coin = mandate::authorize_and_take_sui_for_deepbook(
        &mut mandate,
        20,
        &clock,
        test_scenario::ctx(&mut scenario),
    );
    test_scenario::return_shared(mandate);
    coin::burn_for_testing(coin);

    test_scenario::next_tx(&mut scenario, OWNER);
    let mut mandate = test_scenario::take_shared<Mandate>(&scenario);
    mandate::revoke_mandate(&mut mandate, &clock, test_scenario::ctx(&mut scenario));
    mandate::withdraw_remaining_sui_after_expiry(&mut mandate, &clock, test_scenario::ctx(&mut scenario));
    assert!(mandate::vault_balance(&mandate) == 0, 0);
    test_scenario::return_shared(mandate);

    test_scenario::next_tx(&mut scenario, OWNER);
    let withdrawn = test_scenario::take_from_sender<Coin<SUI>>(&scenario);
    assert!(coin::value(&withdrawn) == 80, 1);
    coin::burn_for_testing(withdrawn);

    clock::destroy_for_testing(clock);
    test_scenario::end(scenario);
}

/// Owner can recover remaining vault SUI after expiry without a separate revoke.
#[test]
fun owner_withdraws_remaining_sui_after_expiry() {
    let mut scenario = test_scenario::begin(OWNER);
    let mut clock = new_clock(&mut scenario);

    create_default_mandate(&mut scenario, &clock);
    clock::increment_for_testing(&mut clock, 86_400_001);

    test_scenario::next_tx(&mut scenario, OWNER);
    let mut mandate = test_scenario::take_shared<Mandate>(&scenario);
    mandate::withdraw_remaining_sui_after_expiry(&mut mandate, &clock, test_scenario::ctx(&mut scenario));
    assert!(mandate::vault_balance(&mandate) == 0, 0);
    assert!(!mandate::is_active(&mandate), 1);
    test_scenario::return_shared(mandate);

    test_scenario::next_tx(&mut scenario, OWNER);
    let withdrawn = test_scenario::take_from_sender<Coin<SUI>>(&scenario);
    assert!(coin::value(&withdrawn) == 100, 2);
    coin::burn_for_testing(withdrawn);

    clock::destroy_for_testing(clock);
    test_scenario::end(scenario);
}

/// Authorized agent can record a blocked attempt without consuming budget.
#[test]
fun agent_records_blocked_action_without_spend() {
    let mut scenario = test_scenario::begin(OWNER);
    let clock = new_clock(&mut scenario);

    create_default_mandate(&mut scenario, &clock);

    test_scenario::next_tx(&mut scenario, AGENT);
    let mandate = test_scenario::take_shared<Mandate>(&scenario);
    mandate::record_blocked_action(
        &mandate,
        21,
        b"exceeds_per_tx_cap",
        &clock,
        test_scenario::ctx(&mut scenario),
    );
    assert!(mandate::current_spent(&mandate) == 0, 0);
    test_scenario::return_shared(mandate);

    clock::destroy_for_testing(clock);
    test_scenario::end(scenario);
}

/// Authorized agent can withdraw an arbitrary vault asset under the same policy.
#[test]
fun agent_takes_generic_vault_coin_success() {
    let mut scenario = test_scenario::begin(OWNER);
    let clock = new_clock(&mut scenario);

    create_testusd_mandate(&mut scenario, &clock);

    test_scenario::next_tx(&mut scenario, AGENT);
    let mut mandate = test_scenario::take_shared<AssetMandate<TESTUSD>>(&scenario);
    let coin = mandate::authorize_and_take_coin_for_deepbook<TESTUSD>(
        &mut mandate,
        100,
        &clock,
        test_scenario::ctx(&mut scenario),
    );
    assert!(mandate::asset_current_spent(&mandate) == 100, 0);
    assert!(mandate::asset_vault_balance(&mandate) == 900, 1);
    test_scenario::return_shared(mandate);
    coin::burn_for_testing(coin);

    clock::destroy_for_testing(clock);
    test_scenario::end(scenario);
}

/// Owner can recover remaining generic vault asset after expiry.
#[test]
fun owner_withdraws_remaining_generic_coin_after_expiry() {
    let mut scenario = test_scenario::begin(OWNER);
    let mut clock = new_clock(&mut scenario);

    create_testusd_mandate(&mut scenario, &clock);
    clock::increment_for_testing(&mut clock, 86_400_001);

    test_scenario::next_tx(&mut scenario, OWNER);
    let mut mandate = test_scenario::take_shared<AssetMandate<TESTUSD>>(&scenario);
    mandate::withdraw_remaining_coin_after_expiry<TESTUSD>(
        &mut mandate,
        &clock,
        test_scenario::ctx(&mut scenario),
    );
    assert!(mandate::asset_vault_balance(&mandate) == 0, 0);
    test_scenario::return_shared(mandate);

    test_scenario::next_tx(&mut scenario, OWNER);
    let withdrawn = test_scenario::take_from_sender<Coin<TESTUSD>>(&scenario);
    assert!(coin::value(&withdrawn) == 1_000, 1);
    coin::burn_for_testing(withdrawn);

    clock::destroy_for_testing(clock);
    test_scenario::end(scenario);
}

/// Non-agent wallets cannot record blocked attempts for the mandate.
#[test]
#[expected_failure(abort_code = 2)]
fun non_agent_record_blocked_action_fails() {
    let mut scenario = test_scenario::begin(OWNER);
    let clock = new_clock(&mut scenario);

    create_default_mandate(&mut scenario, &clock);

    test_scenario::next_tx(&mut scenario, OTHER);
    let mandate = test_scenario::take_shared<Mandate>(&scenario);
    mandate::record_blocked_action(
        &mandate,
        21,
        b"exceeds_per_tx_cap",
        &clock,
        test_scenario::ctx(&mut scenario),
    );
    test_scenario::return_shared(mandate);
    clock::destroy_for_testing(clock);
    test_scenario::end(scenario);
}
