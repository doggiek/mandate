import 'dotenv/config';

import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { isValidSuiAddress } from '@mysten/sui/utils';

const SUI_TYPE = '0x2::sui::SUI';
const NORMALIZED_SUI_TYPE =
  '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI';
const MIST_PER_SUI = 1_000_000_000n;
const DEFAULT_BACKEND_AGENT_ADDRESS =
  '0x91dc52b575b3cd5703be07ee65e12b5af3a25d927b16fa8f94811b7b773ad8b2';

type TransactionLike = {
  digest?: string;
  status?: {
    success?: boolean;
    error?: unknown;
  };
  effects?: {
    gasUsed?: GasUsedLike;
    gas_used?: GasUsedLike;
  };
  events?: Array<{ eventType?: string }>;
  balanceChanges?: Array<{ coinType?: string; amount?: string }>;
};

type GasUsedLike = {
  computationCost?: string;
  computation_cost?: string;
  storageCost?: string;
  storage_cost?: string;
  storageRebate?: string;
  storage_rebate?: string;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function requireEnvWithFallback(name: string, fallbackName: string): string {
  const value = process.env[name] ?? process.env[fallbackName];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function requireSuiAddressEnv(name: string): string {
  const value = requireEnv(name);
  if (!isValidSuiAddress(value)) {
    throw new Error(`${name} must be a valid Sui object/address id, got: ${value}`);
  }
  return value;
}

function normalizeSuiAddress(value: string): string {
  const raw = value.trim().toLowerCase();
  const withoutPrefix = raw.startsWith('0x') ? raw.slice(2) : raw;
  const normalized = withoutPrefix.replace(/^0+/, '') || '0';
  return `0x${normalized}`;
}

function parseSuiToMist(value: string): bigint {
  const [wholePart, fractionalPart = ''] = value.split('.');
  if (!wholePart || !/^\d+$/.test(wholePart) || !/^\d*$/.test(fractionalPart)) {
    throw new Error(`Invalid SUI amount: ${value}`);
  }

  const fractional = fractionalPart.padEnd(9, '0').slice(0, 9);
  return BigInt(wholePart) * MIST_PER_SUI + BigInt(fractional || '0');
}

function formatMistDelta(amount: string | undefined): string {
  if (!amount) {
    return '0 SUI';
  }

  const value = BigInt(amount);
  const sign = value < 0n ? '-' : '';
  const absolute = value < 0n ? -value : value;
  const whole = absolute / MIST_PER_SUI;
  const fractional = (absolute % MIST_PER_SUI).toString().padStart(9, '0').replace(/0+$/, '');

  return `${sign}${whole.toString()}${fractional ? `.${fractional}` : ''} SUI`;
}

function netSuiBalanceChange(balanceChanges: TransactionLike['balanceChanges']): string {
  const total = (balanceChanges ?? [])
    .filter((change) => change.coinType === SUI_TYPE || change.coinType === NORMALIZED_SUI_TYPE)
    .reduce((sum, change) => sum + BigInt(change.amount ?? '0'), 0n);

  return formatMistDelta(total.toString());
}

function gasFee(effects: TransactionLike['effects']): string {
  const gasUsed = effects?.gasUsed ?? effects?.gas_used;
  if (!gasUsed) {
    return '-';
  }

  const computationCost = BigInt(gasUsed.computationCost ?? gasUsed.computation_cost ?? '0');
  const storageCost = BigInt(gasUsed.storageCost ?? gasUsed.storage_cost ?? '0');
  const storageRebate = BigInt(gasUsed.storageRebate ?? gasUsed.storage_rebate ?? '0');
  return formatMistDelta((computationCost + storageCost - storageRebate).toString());
}

function hasBlockedEvent(events: TransactionLike['events'], packageId: string): boolean {
  return (events ?? []).some((event) => event.eventType === `${packageId}::mandate::BlockedEvent`);
}

function reasonBytes(reason: string): number[] {
  return Array.from(new TextEncoder().encode(reason));
}

function printDemoSummary({
  digest,
  mandateId,
  amountSui,
  reason,
  activityEventFound,
  balanceChange,
  gasFeeSui,
}: {
  digest: string;
  mandateId: string;
  amountSui: string;
  reason: string;
  activityEventFound: boolean;
  balanceChange: string;
  gasFeeSui: string;
}) {
  console.log('========================================');
  console.log('Mandate DeepBook Demo');
  console.log('========================================');
  console.log('');
  console.log('Digest:');
  console.log(digest);
  console.log('');
  console.log('Status:');
  console.log('BLOCKED');
  console.log('');
  console.log('Mandate:');
  console.log(mandateId);
  console.log('');
  console.log('Pool:');
  console.log('DEEP_SUI');
  console.log('');
  console.log('Amount:');
  console.log(`${amountSui} SUI`);
  console.log('');
  console.log('Activity Event:');
  console.log(activityEventFound ? 'FOUND' : 'NOT FOUND');
  console.log('');
  console.log('DeepBook Pool Mutation:');
  console.log('NOT FOUND');
  console.log('');
  console.log('Balance Change:');
  console.log(balanceChange);
  console.log('');
  console.log('Gas Fee:');
  console.log(gasFeeSui);
  console.log('');
  console.log('Blocked Reason:');
  console.log(reason);
  console.log('');
  console.log('========================================');
}

async function main() {
  const agentPrivateKey = requireEnvWithFallback('BACKEND_AGENT_PRIVATE_KEY', 'AGENT_PRIVATE_KEY');
  const packageId = requireSuiAddressEnv('PACKAGE_ID');
  const mandateId = requireSuiAddressEnv('MANDATE_ID');
  const amountSui = process.env.AMOUNT_SUI ?? '0.001';
  const blockReason = process.env.BLOCK_REASON ?? 'blocked_by_policy';
  const amountMist = parseSuiToMist(amountSui);

  const { secretKey, scheme } = decodeSuiPrivateKey(agentPrivateKey);
  if (scheme !== 'ED25519') {
    throw new Error(`BACKEND_AGENT_PRIVATE_KEY must be an ED25519 Sui private key, got ${scheme}`);
  }

  const keypair = Ed25519Keypair.fromSecretKey(secretKey);
  const agentAddress = keypair.toSuiAddress();
  const expectedAgentAddress =
    process.env.NEXT_PUBLIC_BACKEND_AGENT_ADDRESS ??
    process.env.NEXT_PUBLIC_VERIFIED_AGENT_ADDRESS ??
    DEFAULT_BACKEND_AGENT_ADDRESS;
  if (normalizeSuiAddress(expectedAgentAddress) !== normalizeSuiAddress(agentAddress)) {
    throw new Error(
      'NEXT_PUBLIC_BACKEND_AGENT_ADDRESS does not match BACKEND_AGENT_PRIVATE_KEY. Update .env.local so the Mandate backend agent address and backend agent signer are the same wallet.',
    );
  }
  const client = new SuiGrpcClient({
    network: 'testnet',
    baseUrl: 'https://fullnode.testnet.sui.io:443',
  });

  const tx = new Transaction();
  tx.setSender(agentAddress);
  tx.moveCall({
    target: `${packageId}::mandate::record_blocked_action`,
    arguments: [
      tx.object(mandateId),
      tx.pure.u64(amountMist),
      tx.pure.vector('u8', reasonBytes(blockReason)),
      tx.object.clock(),
    ],
  });

  const result = await client.core.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    include: {
      effects: true,
      events: true,
      balanceChanges: true,
      transaction: true,
    },
  });

  const submitted = (result.Transaction ?? result.FailedTransaction) as TransactionLike | undefined;
  const digest = submitted?.digest;
  if (!digest) {
    throw new Error('signAndExecuteTransaction did not return a transaction digest');
  }

  const confirmedResult = await client.core.waitForTransaction({
    digest,
    include: {
      effects: true,
      events: true,
      balanceChanges: true,
      transaction: true,
    },
  });

  const confirmed = (confirmedResult.Transaction ?? confirmedResult.FailedTransaction) as
    | TransactionLike
    | undefined;
  if (!confirmed?.digest) {
    throw new Error(`waitForTransaction did not return details for digest ${digest}`);
  }

  if (confirmed.status?.success !== true) {
    throw new Error(
      `Blocked event transaction ${confirmed.digest} failed: ${JSON.stringify(
        confirmed.status?.error ?? null,
      )}`,
    );
  }

  printDemoSummary({
    digest: confirmed.digest,
    mandateId,
    amountSui,
    reason: blockReason,
    activityEventFound: hasBlockedEvent(confirmed.events, packageId),
    balanceChange: netSuiBalanceChange(confirmed.balanceChanges),
    gasFeeSui: gasFee(confirmed.effects),
  });
}

main().catch((error) => {
  if (process.env.DEBUG_STACK === '1') {
    console.error(error);
    process.exit(1);
  }

  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
