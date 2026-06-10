#[test_only]
module mandate::mandate_tests;

use mandate::mandate::{Self, Mandate};
use sui::clock::{Self, Clock};
use sui::test_scenario::{Self, Scenario};

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
    mandate::create_mandate(
        AGENT,
        100,
        20,
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
