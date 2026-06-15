import 'dotenv/config';

import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { isValidSuiAddress } from '@mysten/sui/utils';
import { deepbook } from '@mysten/deepbook-v3';

const SUI_TYPE = '0x2::sui::SUI';
const NORMALIZED_SUI_TYPE =
  '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI';
const MIST_PER_SUI = 1_000_000_000n;
const DEEP_SUI_POOL_ID = '0x48c95963e9eac37a316b7ae04a0deb761bcdcc2b67912374d6036e7f0e9bae9f';
const OLD_PACKAGE_ERROR =
  'Selected mandate belongs to an old package. Create a new mandate with the current package.';

type TransactionLike = {
  digest?: string;
  status?: {
    success?: boolean;
    error?: unknown;
  };
  effects?: {
    changedObjects?: Array<{ objectId?: string; object_id?: string }>;
    changed_objects?: Array<{ objectId?: string; object_id?: string }>;
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

function packageFromObjectType(objectType: string | undefined): string {
  return objectType?.split('::')[0] ?? '';
}

type MandateObjectInfo = {
  objectType?: string;
  owner?: string;
};

function isCurrentMandateObjectType(objectType: string | undefined, packageId: string): boolean {
  return (
    Boolean(objectType?.endsWith('::mandate::Mandate')) &&
    normalizeSuiAddress(packageFromObjectType(objectType)) === normalizeSuiAddress(packageId)
  );
}

async function fetchMandateObjectInfo(mandateId: string): Promise<MandateObjectInfo> {
  const response = await fetch('https://fullnode.testnet.sui.io:443', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'sui_getObject',
      params: [
        mandateId,
        {
          showContent: true,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch mandate object type: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    error?: { message?: string };
    result?: {
      data?: {
        content?: {
          dataType?: string;
          type?: string;
          fields?: Record<string, unknown>;
        };
      };
    };
  };

  if (payload.error) {
    throw new Error(payload.error.message ?? 'Unable to fetch mandate object type');
  }

  const content = payload.result?.data?.content;
  const fields = content?.fields;
  const owner = fields && typeof fields.owner === 'string' ? fields.owner : undefined;
  return {
    objectType: content?.dataType === 'moveObject' ? content.type : undefined,
    owner,
  };
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

function hasMandateActivityEvent(events: TransactionLike['events'], packageId: string): boolean {
  return (events ?? []).some((event) => event.eventType === `${packageId}::mandate::ActivityEvent`);
}

function hasDeepBookPoolMutation(effects: TransactionLike['effects'], poolKey: string): boolean {
  const expectedPoolId = poolKey === 'DEEP_SUI' ? DEEP_SUI_POOL_ID : undefined;
  if (!expectedPoolId) {
    return false;
  }

  const changedObjects = effects?.changedObjects ?? effects?.changed_objects ?? [];
  return changedObjects.some((object) => {
    const objectId = object.objectId ?? object.object_id;
    return objectId?.toLowerCase() === expectedPoolId.toLowerCase();
  });
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

function printDemoSummary({
  digest,
  success,
  mandateId,
  poolKey,
  amountSui,
  activityEventFound,
  deepBookPoolMutated,
  balanceChange,
  gasFeeSui,
  failureReason,
}: {
  digest: string;
  success: boolean;
  mandateId: string;
  poolKey: string;
  amountSui: string;
  activityEventFound: boolean;
  deepBookPoolMutated: boolean;
  balanceChange: string;
  gasFeeSui: string;
  failureReason?: unknown;
}) {
  console.log('========================================');
  console.log('Mandate DeepBook Demo');
  console.log('========================================');
  console.log('');
  console.log('Digest:');
  console.log(digest);
  console.log('');
  console.log('Status:');
  console.log(success ? 'SUCCESS' : 'FAILED');
  console.log('');
  console.log('Mandate:');
  console.log(mandateId);
  console.log('');
  console.log('Pool:');
  console.log(poolKey);
  console.log('');
  console.log('Amount:');
  console.log(`${amountSui} SUI`);
  console.log('');
  console.log('Activity Event:');
  console.log(activityEventFound ? 'FOUND' : 'NOT FOUND');
  console.log('');
  console.log('DeepBook Pool Mutation:');
  console.log(deepBookPoolMutated ? 'FOUND' : 'NOT FOUND');
  console.log('');
  console.log('Balance Change:');
  console.log(balanceChange);
  console.log('');
  console.log('Gas Fee:');
  console.log(gasFeeSui);

  if (!success) {
    console.log('');
    console.log('Failure Reason:');
    console.log(JSON.stringify(failureReason ?? null));
  }

  console.log('');
  console.log('========================================');
}

async function main() {
  const agentPrivateKey = requireEnv('AGENT_PRIVATE_KEY');
  const packageId = requireSuiAddressEnv('PACKAGE_ID');
  const mandateId = requireSuiAddressEnv('MANDATE_ID');

  const poolKey = process.env.POOL_KEY ?? 'DEEP_SUI';
  const amountSui = process.env.AMOUNT_SUI ?? '0.001';
  const strategy = process.env.STRATEGY ?? 'normal';
  const minOut = Number(process.env.MIN_OUT ?? '0');
  const deepAmount = Number(process.env.DEEP_AMOUNT ?? '0');
  const amountMist = parseSuiToMist(amountSui);

  const { secretKey, scheme } = decodeSuiPrivateKey(agentPrivateKey);
  if (scheme !== 'ED25519') {
    throw new Error(`AGENT_PRIVATE_KEY must be an ED25519 Sui private key, got ${scheme}`);
  }

  const keypair = Ed25519Keypair.fromSecretKey(secretKey);
  const agentAddress = keypair.toSuiAddress();
  const mandateObject = await fetchMandateObjectInfo(mandateId);
  const mandateObjectType = mandateObject.objectType;
  const mandateOwner = mandateObject.owner;

  console.log('[MANDATE] agent execution preflight');
  console.log(`[MANDATE] package id: ${packageId}`);
  console.log(`[MANDATE] mandate id: ${mandateId}`);
  console.log(`[MANDATE] mandate objectType: ${mandateObjectType ?? 'unknown'}`);
  console.log(`[MANDATE] mandate owner: ${mandateOwner ?? 'unknown'}`);
  console.log(`[MANDATE] agent wallet address: ${agentAddress}`);
  console.log(`[MANDATE] selected strategy: ${strategy}`);

  if (!isCurrentMandateObjectType(mandateObjectType, packageId)) {
    throw new Error(
      `${OLD_PACKAGE_ERROR} Expected ${packageId}::mandate::Mandate, got ${
        mandateObjectType ?? 'unknown object type'
      }.`,
    );
  }
  if (!mandateOwner || !isValidSuiAddress(mandateOwner)) {
    throw new Error(`Unable to read mandate owner from object ${mandateId}`);
  }

  const client = new SuiGrpcClient({
    network: 'testnet',
    baseUrl: 'https://fullnode.testnet.sui.io:443',
  }).$extend(deepbook({ address: agentAddress }));

  const tx = new Transaction();
  tx.setSender(agentAddress);

  // DEEP_SUI has DEEP as base and SUI as quote. The agent pays gas, but the
  // swap input SUI is withdrawn from the Owner-funded Mandate vault.
  const [inputSuiCoin] = tx.moveCall({
    target: `${packageId}::mandate::authorize_and_take_sui_for_deepbook`,
    arguments: [
      tx.object(mandateId),
      tx.pure.u64(amountMist),
      tx.object.clock(), // 0x6
    ],
  });

  const [baseCoinOut, quoteCoinOut, deepCoinOut] = client.deepbook.deepBook.swapExactQuantity({
    poolKey,
    amount: Number(amountSui),
    deepAmount,
    minOut,
    isBaseToCoin: false,
    quoteCoin: inputSuiCoin,
  })(tx);

  tx.transferObjects([baseCoinOut, quoteCoinOut, deepCoinOut], mandateOwner);

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

  const success = confirmed.status?.success === true;
  const activityEventFound = hasMandateActivityEvent(confirmed.events, packageId);
  const deepBookPoolMutated = hasDeepBookPoolMutation(confirmed.effects, poolKey);

  printDemoSummary({
    digest: confirmed.digest,
    success,
    mandateId,
    poolKey,
    amountSui,
    activityEventFound,
    deepBookPoolMutated,
    balanceChange: netSuiBalanceChange(confirmed.balanceChanges),
    gasFeeSui: gasFee(confirmed.effects),
    failureReason: confirmed.status?.error,
  });

  if (!success) {
    throw new Error(
      `Transaction ${confirmed.digest} failed: ${JSON.stringify(confirmed.status?.error ?? null)}`,
    );
  }
}

main().catch((error) => {
  if (process.env.DEBUG_STACK === '1') {
    console.error(error);
    if (error && typeof error === 'object' && 'issues' in error) {
      console.dir((error as { issues: unknown }).issues, { depth: null });
    }
    process.exit(1);
  }

  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
