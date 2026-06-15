import fs from 'node:fs';
import path from 'node:path';

import dotenv from 'dotenv';
import { deepbook, mainnetCoins, mainnetPools, testnetCoins, testnetPools } from '@mysten/deepbook-v3';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { isValidSuiAddress, normalizeSuiAddress } from '@mysten/sui/utils';

type Network = 'testnet' | 'mainnet';

type Candidate = {
	poolKey: string;
	poolId: string;
	baseCoin: string;
	baseCoinType: string;
	quoteCoin: string;
	quoteCoinType: string;
	direction: 'quote_to_base' | 'base_to_quote';
	targetCoin: string;
	targetCoinType: string;
	targetCoinScalar: number;
};

type QuantityOutQuote = {
	baseOut: number;
	quoteOut: number;
};

type DeepBookProbeClient = {
	core: {
		simulateTransaction(options: {
			transaction: Transaction;
			include?: {
				effects?: boolean;
				events?: boolean;
				balanceChanges?: boolean;
				objectTypes?: boolean;
				transaction?: boolean;
			};
		}): Promise<SimulateResult>;
	};
	deepbook: {
		getBaseQuantityOut(poolKey: string, quoteQuantity: number | bigint): Promise<QuantityOutQuote>;
		getQuoteQuantityOut(poolKey: string, baseQuantity: number | bigint): Promise<QuantityOutQuote>;
		deepBook: {
			swapExactQuantity(params: {
				poolKey: string;
				amount: number | bigint;
				deepAmount: number | bigint;
				minOut: number | bigint;
				isBaseToCoin: boolean;
				baseCoin?: unknown;
				quoteCoin?: unknown;
			}): (tx: Transaction) => readonly [unknown, unknown, unknown];
		};
	};
};

type SimulateResult = {
	$kind: 'Transaction' | 'FailedTransaction';
	Transaction?: SimulatedTransaction;
	FailedTransaction?: SimulatedTransaction;
};

type SimulatedTransaction = {
	digest?: string;
	status?: { success?: boolean; error?: unknown };
	balanceChanges?: Array<{
		coinType?: string;
		address?: string;
		amount?: string;
	}>;
	events?: Array<{
		eventType?: string;
		json?: Record<string, unknown> | null;
	}>;
	objectTypes?: Record<string, string>;
	effects?: unknown;
};

type ProbeResult = {
	market: string;
	poolKey: string;
	poolId: string;
	baseCoinType: string;
	quoteCoinType: string;
	direction: string;
	inputAmount: string;
	sdkQuoteOutput: string;
	sdkResidualSui: string;
	ptbStatus: string;
	ptbOutputAmount: string;
	ptbResidualSui: string;
	fillable: boolean;
	recommendedOutputAmount?: number;
	recommendedOutputCoin?: string;
	error?: string;
};

const SUI_COIN_TYPE = normalizeSuiAddress('0x2') + '::sui::SUI';
const AMOUNTS_SUI = [0.01, 0.05, 0.1, 1];
const MIST_PER_SUI = 1_000_000_000;

loadEnv();

async function main() {
	const network = readNetwork();
	const packageId = requireEnv('NEXT_PUBLIC_PACKAGE_ID');
	const backendAgentAddress = normalizeAddress(
		requireEnvWithFallback('NEXT_PUBLIC_BACKEND_AGENT_ADDRESS', 'NEXT_PUBLIC_VERIFIED_AGENT_ADDRESS'),
	);
	const backendAgentPrivateKey = requireEnvWithFallback('BACKEND_AGENT_PRIVATE_KEY', 'AGENT_PRIVATE_KEY');

	const keypair = keypairFromPrivateKey(backendAgentPrivateKey);
	const signerAddress = normalizeAddress(keypair.getPublicKey().toSuiAddress());

	if (signerAddress !== backendAgentAddress) {
		throw new Error(
			`BACKEND_AGENT_PRIVATE_KEY resolves to ${signerAddress}, but NEXT_PUBLIC_BACKEND_AGENT_ADDRESS is ${backendAgentAddress}`,
		);
	}

	const { pools, coins } =
		network === 'mainnet'
			? { pools: mainnetPools, coins: mainnetCoins }
			: { pools: testnetPools, coins: testnetCoins };

	const candidates: Candidate[] = Object.entries(pools).flatMap<Candidate>(([poolKey, pool]) => {
		const baseCoin = coins[pool.baseCoin];
		const quoteCoin = coins[pool.quoteCoin];

		if (!baseCoin || !quoteCoin) {
			return [];
		}

		const baseCoinType = normalizeCoinType(baseCoin.type);
		const quoteCoinType = normalizeCoinType(quoteCoin.type);

		if (quoteCoinType === SUI_COIN_TYPE) {
			return [
				{
					poolKey,
					poolId: pool.address,
					baseCoin: pool.baseCoin,
					baseCoinType,
					quoteCoin: pool.quoteCoin,
					quoteCoinType,
					direction: 'quote_to_base' as const,
					targetCoin: pool.baseCoin,
					targetCoinType: baseCoinType,
					targetCoinScalar: baseCoin.scalar,
				},
			];
		}

		if (baseCoinType === SUI_COIN_TYPE) {
			return [
				{
					poolKey,
					poolId: pool.address,
					baseCoin: pool.baseCoin,
					baseCoinType,
					quoteCoin: pool.quoteCoin,
					quoteCoinType,
					direction: 'base_to_quote' as const,
					targetCoin: pool.quoteCoin,
					targetCoinType: quoteCoinType,
					targetCoinScalar: quoteCoin.scalar,
				},
			];
		}

		return [];
	});

	if (candidates.length === 0) {
		throw new Error(`No ${network} DeepBook SDK pools use SUI as base or quote coin.`);
	}

	const client = new SuiGrpcClient({
		network,
		baseUrl:
			network === 'mainnet'
				? 'https://fullnode.mainnet.sui.io:443'
				: 'https://fullnode.testnet.sui.io:443',
	}).$extend(deepbook({ address: signerAddress }));

	console.log('Mandate DeepBook fillability probe');
	console.log('Network:', network);
	console.log('Package:', packageId);
	console.log('Backend agent:', signerAddress);
	console.log('Mode: SDK quote + PTB simulateTransaction checks; no transaction is submitted.');
	console.log('');

	await printSuiDbusdcFocus(client, candidates);

	const results: ProbeResult[] = [];

	for (const candidate of candidates) {
		for (const amount of AMOUNTS_SUI) {
			results.push(await probeCandidate(client, candidate, amount, signerAddress));
		}
	}

	console.table(
		results.map((result) => ({
			market: result.market,
			poolKey: result.poolKey,
			poolId: shortId(result.poolId),
			direction: result.direction,
			input: result.inputAmount,
			sdkQuote: result.sdkQuoteOutput,
			ptbStatus: result.ptbStatus,
			ptbOutput: result.ptbOutputAmount,
			residualSui: result.ptbResidualSui,
			fillable: result.fillable,
			error: result.error ?? '',
		})),
	);

	const recommended = results.find((result) => result.fillable);
	if (!recommended) {
		const sdkQuoteAllZero = results.every((result) => result.sdkQuoteOutput.startsWith('0 '));
		const ptbNoFill = results.every(
			(result) =>
				result.ptbStatus !== 'success' ||
				result.ptbOutputAmount.startsWith('0 ') ||
				result.ptbOutputAmount === 'amount unavailable',
		);

		console.log('');
		console.log('No fillable SUI-input DeepBook pool was found for the tested amounts.');
		console.log('Conclusion:');
		console.log(`- SDK quote all zero: ${sdkQuoteAllZero ? 'yes' : 'no'}`);
		console.log(`- PTB simulate/devInspect no-fill or unavailable: ${ptbNoFill ? 'yes' : 'no'}`);
		console.log('- This likely means the current testnet order books have no usable liquidity at these sizes.');
		console.log(
			'- Next steps: self-provide liquidity, find an official faucet token/pool with live testnet orders, try mainnet with a tiny amount, or keep the UI explicit about no-fill rather than mocking a fill.',
		);
		return;
	}

	console.log('');
	console.log('Recommended configuration:');
	console.log(`NEXT_PUBLIC_DEEPBOOK_POOL_KEY=${recommended.poolKey}`);
	console.log(`NEXT_PUBLIC_DEEPBOOK_POOL_ID=${recommended.poolId}`);
	console.log('Direction:', recommended.direction);
	console.log('Input:', recommended.inputAmount);
	console.log('Output coin:', recommended.recommendedOutputCoin ?? 'unknown');
	console.log('Output amount:', recommended.ptbOutputAmount);
}

async function probeCandidate(
	client: DeepBookProbeClient,
	candidate: Candidate,
	amountSui: number,
	sender: string,
): Promise<ProbeResult> {
	const base: ProbeResult = {
		market: `${candidate.baseCoin}/${candidate.quoteCoin}`,
		poolKey: candidate.poolKey,
		poolId: candidate.poolId,
		baseCoinType: candidate.baseCoinType,
		quoteCoinType: candidate.quoteCoinType,
		direction:
			candidate.direction === 'quote_to_base'
				? `SUI -> ${candidate.targetCoin}`
				: `SUI -> ${candidate.targetCoin}`,
		inputAmount: `${formatAmount(amountSui)} SUI`,
		sdkQuoteOutput: `0 ${candidate.targetCoin}`,
		sdkResidualSui: `${formatAmount(amountSui)} SUI`,
		ptbStatus: 'not_run',
		ptbOutputAmount: `0 ${candidate.targetCoin}`,
		ptbResidualSui: `${formatAmount(amountSui)} SUI`,
		fillable: false,
	};

	try {
		const quote = await quoteSuiToTarget(client, candidate, amountSui);
		const ptb = await simulateSwapPtb(client, candidate, amountSui, sender);
		const outputAmount = ptb.outputAmount ?? quote.outputAmount;

		const result = {
			...base,
			sdkQuoteOutput: `${formatAmount(quote.outputAmount)} ${candidate.targetCoin}`,
			sdkResidualSui: `${formatAmount(quote.residualSui)} SUI`,
			ptbStatus: ptb.status,
			ptbOutputAmount:
				ptb.outputAmount == null
					? ptb.status === 'success'
						? 'amount unavailable'
						: `0 ${candidate.targetCoin}`
					: `${formatAmount(ptb.outputAmount)} ${candidate.targetCoin}`,
			ptbResidualSui:
				ptb.residualSui == null ? 'unknown' : `${formatAmount(ptb.residualSui)} SUI`,
			fillable: outputAmount > 0,
			recommendedOutputAmount: outputAmount,
			recommendedOutputCoin: candidate.targetCoinType,
			error: ptb.error,
		};

		return result;
	} catch (error) {
		return {
			...base,
			ptbStatus: 'error',
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

async function quoteSuiToTarget(
	client: DeepBookProbeClient,
	candidate: Candidate,
	amountSui: number,
) {
	if (candidate.direction === 'quote_to_base') {
		const quote = await client.deepbook.getBaseQuantityOut(candidate.poolKey, amountSui);
		return {
			outputAmount: quote.baseOut,
			residualSui: quote.quoteOut,
		};
	}

	const quote = await client.deepbook.getQuoteQuantityOut(candidate.poolKey, amountSui);
	return {
		outputAmount: quote.quoteOut,
		residualSui: quote.baseOut,
	};
}

async function simulateSwapPtb(
	client: DeepBookProbeClient,
	candidate: Candidate,
	amountSui: number,
	sender: string,
) {
	const tx = new Transaction();
	tx.setSender(sender);

	const [inputSuiCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(suiToMist(amountSui))]);
	const [baseCoinOut, quoteCoinOut, deepCoinOut] = client.deepbook.deepBook.swapExactQuantity({
		poolKey: candidate.poolKey,
		amount: amountSui,
		deepAmount: 0,
		minOut: 0,
		isBaseToCoin: candidate.direction === 'base_to_quote',
		...(candidate.direction === 'base_to_quote'
			? { baseCoin: inputSuiCoin }
			: { quoteCoin: inputSuiCoin }),
	})(tx);

	tx.transferObjects([baseCoinOut, quoteCoinOut, deepCoinOut] as never[], sender);

	try {
		const result = await client.core.simulateTransaction({
			transaction: tx,
			include: {
				effects: true,
				events: true,
				balanceChanges: true,
				objectTypes: true,
				transaction: true,
			},
		});

		const simulated = result.Transaction ?? result.FailedTransaction;
		const success = result.$kind === 'Transaction' && simulated?.status?.success !== false;
		if (!success) {
			return {
				status: 'failed',
				error: stringifyError(simulated?.status?.error ?? simulated?.status),
			};
		}

		return parseSimulatedSwapResult(simulated, candidate, amountSui);
	} catch (error) {
		return {
			status: 'error',
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

function parseSimulatedSwapResult(
	tx: SimulatedTransaction | undefined,
	candidate: Candidate,
	inputAmountSui: number,
) {
	const balanceChanges = tx?.balanceChanges ?? [];
	const targetChange = balanceChanges
		.filter(
			(change) =>
				normalizeCoinType(change.coinType ?? '') === candidate.targetCoinType &&
				Number(change.amount ?? 0) > 0,
		)
		.reduce((sum, change) => sum + Number(change.amount ?? 0), 0);

	const suiPositiveChange = balanceChanges
		.filter(
			(change) =>
				normalizeCoinType(change.coinType ?? '') === SUI_COIN_TYPE && Number(change.amount ?? 0) > 0,
		)
		.reduce((sum, change) => sum + Number(change.amount ?? 0), 0);

	if (targetChange > 0) {
		return {
			status: 'success',
			outputAmount: targetChange / candidate.targetCoinScalar,
			residualSui: suiPositiveChange > 0 ? suiPositiveChange / MIST_PER_SUI : 0,
		};
	}

	const targetObjectCount = Object.values(tx?.objectTypes ?? {}).filter(
		(type) => normalizeCoinType(type).includes(`coin::Coin<${candidate.targetCoinType}>`),
	).length;

	return {
		status: 'success',
		outputAmount: targetObjectCount > 0 ? 0 : undefined,
		residualSui: suiPositiveChange > 0 ? suiPositiveChange / MIST_PER_SUI : undefined,
	};
}

async function printSuiDbusdcFocus(client: DeepBookProbeClient, candidates: Candidate[]) {
	const suiDbusdc = candidates.find((candidate) => candidate.poolKey === 'SUI_DBUSDC');
	if (!suiDbusdc) {
		return;
	}

	console.log('SUI_DBUSDC focus:');
	console.log('  pool id:', suiDbusdc.poolId);
	console.log('  base:', suiDbusdc.baseCoin, suiDbusdc.baseCoinType);
	console.log('  quote:', suiDbusdc.quoteCoin, suiDbusdc.quoteCoinType);
	console.log('  SUI -> DBUSDC:', suiDbusdc.direction === 'base_to_quote' ? 'yes' : 'no');
	console.log('  DBUSDC -> SUI:', suiDbusdc.direction === 'base_to_quote' ? 'yes, reverse direction' : 'n/a');
	try {
		const reverseQuote = await client.deepbook.getBaseQuantityOut('SUI_DBUSDC', 1);
		console.log(
			'  Reverse quote 1 DBUSDC -> SUI:',
			`${formatAmount(reverseQuote.baseOut)} SUI, residual ${formatAmount(reverseQuote.quoteOut)} DBUSDC`,
		);
	} catch (error) {
		console.log('  Reverse quote 1 DBUSDC -> SUI failed:', error instanceof Error ? error.message : error);
	}
	console.log('');
}

function loadEnv() {
	const cwd = process.cwd();
	const envLocalPath = path.resolve(cwd, '.env.local');
	const envPath = path.resolve(cwd, '.env');

	if (fs.existsSync(envLocalPath)) {
		dotenv.config({ path: envLocalPath, override: true });
	}

	if (fs.existsSync(envPath)) {
		dotenv.config({ path: envPath, override: false });
	}
}

function readNetwork(): Network {
	const value = process.env.NEXT_PUBLIC_SUI_NETWORK?.toLowerCase() || 'testnet';

	if (value === 'testnet' || value === 'mainnet') {
		return value;
	}

	throw new Error(
		`NEXT_PUBLIC_SUI_NETWORK must be "testnet" or "mainnet" for DeepBook SDK pool probing, got "${value}"`,
	);
}

function requireEnv(name: string) {
	const value = process.env[name];
	if (!value) {
		throw new Error(`${name} is required`);
	}
	return value;
}

function requireEnvWithFallback(primaryName: string, fallbackName: string) {
	const value = process.env[primaryName] ?? process.env[fallbackName];
	if (!value) {
		throw new Error(`${primaryName} is required`);
	}
	return value;
}

function keypairFromPrivateKey(privateKey: string) {
	const decoded = decodeSuiPrivateKey(privateKey);
	const scheme = (decoded as { scheme?: string; schema?: string; keyScheme?: string }).scheme
		?? (decoded as { schema?: string }).schema
		?? (decoded as { keyScheme?: string }).keyScheme;

	if (scheme !== 'ED25519') {
		throw new Error(`BACKEND_AGENT_PRIVATE_KEY must be ED25519, got ${scheme ?? 'unknown'}`);
	}

	return Ed25519Keypair.fromSecretKey(decoded.secretKey);
}

function suiToMist(amountSui: number) {
	return BigInt(Math.round(amountSui * MIST_PER_SUI));
}

function normalizeAddress(value: string) {
	if (!isValidSuiAddress(value)) {
		throw new Error(`Invalid Sui address: ${value}`);
	}

	return normalizeSuiAddress(value);
}

function normalizeCoinType(value: string) {
	const [address, moduleName, structName] = value.split('::');
	if (!address || !moduleName || !structName) {
		return value;
	}

	return `${normalizeSuiAddress(address)}::${moduleName}::${structName}`;
}

function formatAmount(value: number) {
	if (!Number.isFinite(value)) {
		return String(value);
	}

	return value.toLocaleString('en-US', {
		maximumFractionDigits: 9,
		useGrouping: false,
	});
}

function shortId(value: string) {
	return value.length <= 12 ? value : `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function stringifyError(value: unknown) {
	if (value == null) {
		return '';
	}

	if (typeof value === 'string') {
		return value;
	}

	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
