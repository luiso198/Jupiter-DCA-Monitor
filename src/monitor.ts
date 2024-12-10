import { Connection, PublicKey } from '@solana/web3.js';
import { DCA } from '@jup-ag/dca-sdk';
import { config } from './config';
import { TelegramService } from './telegram';
import BN from 'bn.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import axios from 'axios';
import { WebServer } from './server';
import { StorageService } from './storage';
import { Logger } from './logger';

// First cast to unknown, then to our type
type ProgramDCAAccount = {
    publicKey: PublicKey;
    account: {
        user: PublicKey;
        inputMint: PublicKey;
        outputMint: PublicKey;
        idx: BN;
        nextCycleAt: BN;
        inDeposited: BN;
        inWithdrawn: BN;
        outWithdrawn: BN;
        inUsed: BN;
        inAmountPerCycle: BN;
        cycleFrequency: BN;
        bump: number;
        minOutAmount?: BN;
        maxOutAmount?: BN;
    };
};

// Add these interfaces near the top of the file, after the imports
interface JupiterTokenInfo {
    [key: string]: {
        symbol: string;
        decimals: number;
    };
}

interface SolscanTokenResponse {
    data: {
        symbol: string;
        decimals: string | number;
    };
}

interface TokenInfo {
    symbol: string;
    decimals: number;
}

interface TokenSummary {
    buyPositions: number;
    sellPositions: number;
    totalBuyVolume: BN;
    totalSellVolume: BN;
}

interface TokenSnapshot {
    timestamp: number;
    buyOrders: number;
    sellOrders: number;
    buyVolume: number;
    sellVolume: number;
}

interface JupiterPriceData {
    data: {
        [key: string]: {
            id: string;
            mintSymbol: string;
            vsToken: string;
            vsTokenSymbol: string;
            price: number;
        }
    }
}

interface CachedPrice {
    price: number;
    timestamp: number;
}

interface StoredPosition {
    token: 'LOGOS' | 'CHAOS';
    type: 'BUY' | 'SELL';
    publicKey: string;
    inputToken: string;
    outputToken: string;
    totalAmount: string;
    amountPerCycle: string;
    frequency: number;
    lastUpdate: number;
}

interface WebSummaryData {
    buyOrders: number;
    sellOrders: number;
    buyVolume: number;
    sellVolume: number;
}

interface WebSummary {
    timestamp: number;
    data: {
        [key: string]: WebSummaryData;
    };
}

export class JupiterMonitor {
    private readonly connection: Connection;
    private readonly telegram: TelegramService;
    private readonly dca: DCA;
    private readonly webServer?: WebServer;
    private readonly storage: StorageService;
    private isRunning = false;
    private tokenNameCache = new Map<string, string>();
    private priceCache = new Map<string, { price: number; timestamp: number }>();
    private readonly PRICE_CACHE_TTL = 60000; // 1 minute cache
    private readonly BATCH_SIZE = 100; // Number of tokens to request prices for at once
    private readonly MAX_RETRIES = 5;
    private readonly RETRY_DELAY = 2000; // 2 seconds

    // Token addresses
    private readonly LOGOS = new PublicKey('HJUfqXoYjC653f2p33i84zdCC3jc4EuVnbruSe5kpump');
    private readonly CHAOS = new PublicKey('8SgNwESovnbG1oNEaPVhg6CR9mTMSK7jPvcYRe3wpump');
    
    // Common token mapping for fallback
    private readonly TOKEN_INFO: { [key: string]: { symbol: string, decimals: number } } = {
        'HJUfqXoYjC653f2p33i84zdCC3jc4EuVnbruSe5kpump': { symbol: 'LOGOS', decimals: 6 },
        '8SgNwESovnbG1oNEaPVhg6CR9mTMSK7jPvcYRe3wpump': { symbol: 'CHAOS', decimals: 6 },
        'So11111111111111111111111111111111111111112': { symbol: 'SOL', decimals: 9 },
        // Keep USDC/USDT for price calculations
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { symbol: 'USDC', decimals: 6 },
        'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { symbol: 'USDT', decimals: 6 }
    };

    constructor(webServer?: WebServer) {
        this.webServer = webServer;
        this.connection = new Connection(config.solana.rpcEndpoint);
        this.dca = new DCA(this.connection);
        this.telegram = new TelegramService();
        this.storage = new StorageService();
    }

    async start() {
        try {
            this.isRunning = true;
            
            // Load initial state
            const state = this.storage.getState();
            
            // Initialize web interface with state
            if (this.webServer) {
                this.webServer.updateState(
                    state.positions,
                    state.summary
                );
            }

            // Start monitoring
            await this.pollDcaPositions();
        } catch (error) {
            throw error;
        }
    }

    private async pollDcaPositions() {
        let lastSummaryTime = 0;
        const SUMMARY_INTERVAL = 10000;
        let isFirstRun = true;

        while (this.isRunning) {
            try {
                const allDcaAccounts = (await this.dca.getAll()) as ProgramDCAAccount[];
                
                // Add detailed logging here using Logger.info
                allDcaAccounts.forEach(pos => {
                    Logger.info('Raw DCA Position:', {
                        publicKey: pos.publicKey.toString(),
                        inputToken: this.TOKEN_INFO[pos.account.inputMint.toString()]?.symbol || pos.account.inputMint.toString(),
                        outputToken: this.TOKEN_INFO[pos.account.outputMint.toString()]?.symbol || pos.account.outputMint.toString(),
                        inDeposited: pos.account.inDeposited.toString(),
                        inWithdrawn: pos.account.inWithdrawn.toString(),
                        inAmountPerCycle: pos.account.inAmountPerCycle.toString(),
                        cycleFrequency: pos.account.cycleFrequency.toNumber()
                    });
                });

                const activePositions = allDcaAccounts.filter(pos => {
                    if (!pos.account.inDeposited.gt(pos.account.inWithdrawn)) {
                        console.log('Filtered out inactive position:', pos.publicKey.toString());
                        return false;
                    }
                    
                    const inputMint = pos.account.inputMint.toString();
                    const outputMint = pos.account.outputMint.toString();
                    
                    const isIncluded = (
                        inputMint === this.LOGOS.toString() || 
                        outputMint === this.LOGOS.toString() ||
                        inputMint === this.CHAOS.toString() || 
                        outputMint === this.CHAOS.toString()
                    );

                    if (!isIncluded) {
                        console.log('Filtered out by token:', {
                            publicKey: pos.publicKey.toString(),
                            inputMint,
                            outputMint
                        });
                    }
                    
                    return isIncluded;
                });

                // Generate summary if needed
                if (isFirstRun || Date.now() - lastSummaryTime >= SUMMARY_INTERVAL) {
                    this.generateDcaSummary(activePositions);
                    lastSummaryTime = Date.now();
                }

                isFirstRun = false;
            } catch (error) {
                Logger.error('Error in DCA monitor:', error);
            }
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    private async fetchDCAAccounts(): Promise<ProgramDCAAccount[]> {
        return this.withRetry(async () => {
            try {
                const accounts = await this.dca.getAll();
                return accounts;
            } catch (error) {
                Logger.error('Error fetching DCA accounts:', error);
                throw error;
            }
        });
    }

    private async getConnection(): Promise<Connection> {
        return this.withRetry(async () => {
            try {
                // Test the connection
                await this.connection.getLatestBlockhash();
                return this.connection;
            } catch (error) {
                Logger.error('RPC connection error:', error);
                // Create a new connection if the current one fails
                return new Connection(config.solana.rpcEndpoint, 'confirmed');
            }
        });
    }

    private formatStoredPosition(position: StoredPosition): string {
        const directionArrow = position.type === 'BUY' ? '🟢 ⬆️' : '🔴 ⬇️';
        return [
            `${directionArrow} ${position.token} DCA Position (${position.type === 'BUY' ? 'Buying' : 'Selling'} ${position.token})`,
            `Input Token: ${position.inputToken}`,
            `Output Token: ${position.outputToken}`,
            `Total Amount: ${position.totalAmount}`,
            `Amount Per Cycle: ${position.amountPerCycle}`,
            `Frequency: Every ${position.frequency} seconds`,
            `Position: https://solscan.io/account/${position.publicKey}`
        ].join('\n');
    }

    public stop(): void {
        this.isRunning = false;
    }

    private async getMarketPrice(inputMint: PublicKey, outputMint: PublicKey): Promise<number> {
        const now = Date.now();
        const cacheKey = `${inputMint.toString()}-${outputMint.toString()}`;
        const cached = this.priceCache.get(cacheKey);

        if (cached && now - cached.timestamp < this.PRICE_CACHE_TTL) {
            return cached.price;
        }

        const maxRetries = 5;
        let retryCount = 0;

        while (retryCount < maxRetries) {
            try {
                // Get input token price in USD
                const inputResponse = await axios.get<{
                    data: {
                        [key: string]: {
                            price: number;
                        };
                    };
                }>(`https://price.jup.ag/v4/price?ids=${inputMint.toString()}&vsToken=USDC`);
                const inputPriceUSD = inputResponse.data.data[inputMint.toString()]?.price || 1;

                // Get output token price in USD
                const outputResponse = await axios.get<{
                    data: {
                        [key: string]: {
                            price: number;
                        };
                    };
                }>(`https://price.jup.ag/v4/price?ids=${outputMint.toString()}&vsToken=USDC`);
                const outputPriceUSD = outputResponse.data.data[outputMint.toString()]?.price || 1;

                if (inputPriceUSD && outputPriceUSD) {
                    // Calculate relative price: inputPriceUSD/outputPriceUSD gives us outputToken/inputToken
                    const price = inputPriceUSD / outputPriceUSD;
                    this.priceCache.set(cacheKey, { price, timestamp: now });
                    return price;
                }
                return 1;
            } catch (error) {
                Logger.error(`Error fetching price (attempt ${retryCount + 1}/${maxRetries}):`, error);
                retryCount++;
                if (retryCount < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                }
            }
        }

        return 1; // Default to 1:1 if all retries fail
    }

    private async batchGetMarketPrices(pairs: { input: PublicKey, output: PublicKey }[]): Promise<Map<string, number>> {
        const now = Date.now();
        const results = new Map<string, number>();
        const uncachedPairs = pairs.filter(({ input, output }) => {
            const cacheKey = `${input.toString()}-${output.toString()}`;
            const cached = this.priceCache.get(cacheKey);
            if (cached && now - cached.timestamp < this.PRICE_CACHE_TTL) {
                results.set(cacheKey, cached.price);
                return false;
            }
            return true;
        });

        if (uncachedPairs.length === 0) {
            return results;
        }

        try {
            // Get all unique token addresses
            const uniqueTokens = new Set<string>();
            uncachedPairs.forEach(({ input, output }) => {
                uniqueTokens.add(input.toString());
                uniqueTokens.add(output.toString());
            });

            // Fetch USD prices for all tokens in one request
            const tokenList = Array.from(uniqueTokens).join(',');
            const response = await axios.get<{
                data: {
                    [key: string]: {
                        price: number;
                    };
                };
            }>(`https://price.jup.ag/v4/price?ids=${tokenList}&vsToken=USDC`);

            // Store USD prices
            const usdPrices = new Map<string, number>();
            for (const [token, data] of Object.entries(response.data.data)) {
                usdPrices.set(token, data.price);
            }

            // Calculate relative prices for each pair
            for (const { input, output } of uncachedPairs) {
                const inputPriceUSD = usdPrices.get(input.toString()) || 1;
                const outputPriceUSD = usdPrices.get(output.toString()) || 1;
                const price = inputPriceUSD / outputPriceUSD;
                const cacheKey = `${input.toString()}-${output.toString()}`;
                this.priceCache.set(cacheKey, { price, timestamp: now });
                results.set(cacheKey, price);
            }
        } catch (error) {
            Logger.error('Error fetching batch prices:', error);
            // Use default price of 1 for failed requests
            for (const { input, output } of uncachedPairs) {
                const cacheKey = `${input.toString()}-${output.toString()}`;
                this.priceCache.set(cacheKey, { price: 1, timestamp: now });
                results.set(cacheKey, 1);
            }
        }

        return results;
    }

    private async generateDcaSummary(positions: ProgramDCAAccount[]): Promise<string> {
        const summary = {
            LOGOS: { buyOrders: 0, sellOrders: 0, buyVolume: 0, sellVolume: 0 },
            CHAOS: { buyOrders: 0, sellOrders: 0, buyVolume: 0, sellVolume: 0 }
        };

        for (const pos of positions) {
            const inputMint = pos.account.inputMint.toString();
            const outputMint = pos.account.outputMint.toString();
            
            // Calculate total remaining amount
            const totalAmount = pos.account.inDeposited.sub(pos.account.inWithdrawn);
            const volume = Number(totalAmount.toString()) / Math.pow(10, 6);

            // Process LOGOS positions
            if (inputMint === this.LOGOS.toString() || outputMint === this.LOGOS.toString()) {
                const isBuying = outputMint === this.LOGOS.toString();
                if (isBuying) {
                    summary.LOGOS.buyOrders++;
                    summary.LOGOS.buyVolume += volume;
                } else {
                    summary.LOGOS.sellOrders++;
                    summary.LOGOS.sellVolume += volume;
                }
            }

            // Process CHAOS positions
            if (inputMint === this.CHAOS.toString() || outputMint === this.CHAOS.toString()) {
                const isBuying = outputMint === this.CHAOS.toString();
                if (isBuying) {
                    summary.CHAOS.buyOrders++;
                    summary.CHAOS.buyVolume += volume;
                } else {
                    summary.CHAOS.sellOrders++;
                    summary.CHAOS.sellVolume += volume;
                }
            }
        }

        // Get formatted positions first
        const formattedPositions = await this.formatPositions(positions);

        // Create state update
        const state = {
            timestamp: Date.now(),
            summary,
            positions: formattedPositions,
            chartData: {
                LOGOS: [{
                    timestamp: Date.now(),
                    buyVolume: summary.LOGOS.buyVolume,
                    sellVolume: summary.LOGOS.sellVolume,
                    buyOrders: summary.LOGOS.buyOrders,
                    sellOrders: summary.LOGOS.sellOrders
                }],
                CHAOS: [{
                    timestamp: Date.now(),
                    buyVolume: summary.CHAOS.buyVolume,
                    sellVolume: summary.CHAOS.sellVolume,
                    buyOrders: summary.CHAOS.buyOrders,
                    sellOrders: summary.CHAOS.sellOrders
                }]
            }
        };

        // Update storage and web interface
        if (this.webServer) {
            const chartData = {
                LOGOS: [{
                    timestamp: Date.now(),
                    buyVolume: summary.LOGOS.buyVolume,
                    sellVolume: summary.LOGOS.sellVolume,
                    buyOrders: summary.LOGOS.buyOrders,
                    sellOrders: summary.LOGOS.sellOrders
                }],
                CHAOS: [{
                    timestamp: Date.now(),
                    buyVolume: summary.CHAOS.buyVolume,
                    sellVolume: summary.CHAOS.sellVolume,
                    buyOrders: summary.CHAOS.buyOrders,
                    sellOrders: summary.CHAOS.sellOrders
                }]
            };
            this.webServer.updateState(formattedPositions, state.summary, chartData);
        }

        // Format and send Telegram message
        const message = [
            ' Jupiter DCA Summary:\n',
            'LOGOS:',
            `🟢 Buy Orders: ${summary.LOGOS.buyOrders}`,
            `🔴 Sell Orders: ${summary.LOGOS.sellOrders}`,
            `💰 Buy Volume: ${summary.LOGOS.buyVolume.toLocaleString()}`,
            `💰 Sell Volume: ${summary.LOGOS.sellVolume.toLocaleString()}\n`,
            'CHAOS:',
            `🟢 Buy Orders: ${summary.CHAOS.buyOrders}`,
            `🔴 Sell Orders: ${summary.CHAOS.sellOrders}`,
            `💰 Buy Volume: ${summary.CHAOS.buyVolume.toLocaleString()}`,
            `💰 Sell Volume: ${summary.CHAOS.sellVolume.toLocaleString()}`
        ].join('\n');

        await this.telegram.sendAlert(message);
        return message;
    }

    // Add helper method for calculating expected output
    private calculateExpectedOutput(inputAmount: BN, inputDecimals: number, outputDecimals: number): BN {
        // This is a simplified calculation - in reality we'd need price data
        // For now, let's adjust for decimal differences
        const decimalDiff = outputDecimals - inputDecimals;
        if (decimalDiff > 0) {
            return inputAmount.mul(new BN(10).pow(new BN(decimalDiff)));
        } else if (decimalDiff < 0) {
            return inputAmount.div(new BN(10).pow(new BN(-decimalDiff)));
        }
        return inputAmount;
    }

    private async getTokenInfo(mintAddress: PublicKey): Promise<{ symbol: string, decimals: number }> {
        const address = mintAddress.toString();
        
        // First check our TOKEN_INFO mapping
        if (this.TOKEN_INFO[address]) {
            return this.TOKEN_INFO[address];
        }

        // If it's not in our TOKEN_INFO, we'll ignore it
        // This way we only track our monitored tokens
        const shortAddr = `${address.slice(0, 4)}...${address.slice(-4)}`;
        return { 
            symbol: `Unknown (${shortAddr})`,
            decimals: 9
        };
    }

    private async formatTokenAmount(amount: BN, mint: PublicKey): Promise<string> {
        try {
            const tokenInfo = await this.getTokenInfo(mint);
            const decimals = tokenInfo.decimals;
            const divisor = new BN(10).pow(new BN(decimals));
            
            // Convert to decimal string with proper precision
            const fullAmount = amount.toString().padStart(decimals + 1, '0');
            const integerPart = fullAmount.slice(0, -decimals) || '0';
            const fractionalPart = fullAmount.slice(-decimals);
            
            const formattedNumber = `${integerPart}.${fractionalPart}`;
            // Remove trailing zeros and decimal if whole number
            const cleanedNumber = formattedNumber.replace(/\.?0+$/, '');
            
            return `${cleanedNumber} ${tokenInfo.symbol}`;
        } catch (error) {
            Logger.error('Error formatting token amount:', error);
            return '0';
        }
    }

    private async fetchBatchPrices(pairs: { input: PublicKey, output: PublicKey }[]): Promise<Map<string, number>> {
        const results = new Map<string, number>();
        const uncachedPairs: { input: PublicKey, output: PublicKey }[] = [];
        const now = Date.now();

        // First check if we have the tokens in our TOKEN_INFO
        for (const { input, output } of pairs) {
            const inputStr = input.toString();
            const outputStr = output.toString();
            
            // Skip if either token is not in our TOKEN_INFO
            if (!this.TOKEN_INFO[inputStr] || !this.TOKEN_INFO[outputStr]) {
                const cacheKey = `${inputStr}-${outputStr}`;
                results.set(cacheKey, 1); // Default to 1:1 for unknown tokens
                continue;
            }

            const cacheKey = `${inputStr}-${outputStr}`;
            const cached = this.priceCache.get(cacheKey);
            if (cached && now - cached.timestamp < this.PRICE_CACHE_TTL) {
                results.set(cacheKey, cached.price);
            } else {
                uncachedPairs.push({ input, output });
            }
        }

        if (uncachedPairs.length === 0) {
            return results;
        }

        // Fetch prices in smaller batches
        const BATCH_SIZE = 5;
        for (let i = 0; i < uncachedPairs.length; i += BATCH_SIZE) {
            const batch = uncachedPairs.slice(i, Math.min(i + BATCH_SIZE, uncachedPairs.length));
            
            try {
                // Fetch prices for each pair in parallel
                const pricePromises = batch.map(async ({ input, output }) => {
                    try {
                        const inputStr = input.toString();
                        const outputStr = output.toString();
                        
                        // Skip if either token is not in our TOKEN_INFO
                        if (!this.TOKEN_INFO[inputStr] || !this.TOKEN_INFO[outputStr]) {
                            return { input: inputStr, output: outputStr, price: 1 };
                        }

                        const response = await axios.get<{
                            data: {
                                [key: string]: {
                                    price: number;
                                };
                            };
                        }>(
                            `https://price.jup.ag/v4/price?ids=${inputStr}&vsToken=${outputStr}`
                        );
                        
                        const price = response.data.data[inputStr]?.price || 1;
                        return { input: inputStr, output: outputStr, price };
                    } catch (error) {
                        Logger.error('Error fetching price for pair:', error);
                        return { input: input.toString(), output: output.toString(), price: 1 };
                    }
                });

                const prices = await Promise.all(pricePromises);
                
                // Update cache and results
                for (const { input, output, price } of prices) {
                    const cacheKey = `${input}-${output}`;
                    this.priceCache.set(cacheKey, { price, timestamp: now });
                    results.set(cacheKey, price);
                }

                // Add small delay between batches to avoid rate limiting
                if (i + BATCH_SIZE < uncachedPairs.length) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            } catch (error) {
                Logger.error('Error fetching batch prices:', error);
                // Use default price of 1 for failed requests
                for (const { input, output } of batch) {
                    const cacheKey = `${input.toString()}-${output.toString()}`;
                    this.priceCache.set(cacheKey, { price: 1, timestamp: now });
                    results.set(cacheKey, 1);
                }
            }
        }

        return results;
    }

    private async fetchHistoricalExecutions() {
        const now = Date.now();
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);

        try {
            // Get all current DCA positions
            const allDcaAccounts = (await this.dca.getAll()) as ProgramDCAAccount[];
            const activePositions = allDcaAccounts.filter(pos => 
                pos.account.inDeposited.gt(pos.account.inWithdrawn)
            );

            // Initialize hourly data for the day
            const hourlyData: { [hour: number]: { [token: string]: TokenSnapshot } } = {};
            for (let hour = 0; hour < 24; hour++) {
                hourlyData[hour] = {
                    'LOGOS': {
                        timestamp: new Date(startOfDay.getTime() + (hour * 60 * 60 * 1000)).getTime(),
                        buyOrders: 0,
                        sellOrders: 0,
                        buyVolume: 0,
                        sellVolume: 0
                    },
                    'CHAOS': {
                        timestamp: new Date(startOfDay.getTime() + (hour * 60 * 60 * 1000)).getTime(),
                        buyOrders: 0,
                        sellOrders: 0,
                        buyVolume: 0,
                        sellVolume: 0
                    }
                };
            }

            // Process each active position
            for (const pos of activePositions) {
                // Calculate position's hourly contribution
                const cycleFrequency = pos.account.cycleFrequency.toNumber();
                const cyclesPerHour = Math.floor(3600 / cycleFrequency);
                
                // Get input and output token info
                const inputMint = pos.account.inputMint;
                const outputMint = pos.account.outputMint;
                const inputInfo = await this.getTokenInfo(inputMint);
                const outputInfo = await this.getTokenInfo(outputMint);

                // Calculate volumes
                const amountPerCycle = await this.formatTokenAmount(
                    pos.account.inAmountPerCycle,
                    inputMint
                );

                // Process LOGOS positions
                if (inputMint.equals(this.LOGOS) || outputMint.equals(this.LOGOS)) {
                    const isBuying = outputMint.equals(this.LOGOS);
                    const hourlyAmount = Number(amountPerCycle) * cyclesPerHour;

                    // Add to each hour's data
                    for (let hour = 0; hour < 24; hour++) {
                        if (isBuying) {
                            hourlyData[hour]['LOGOS'].buyOrders++;
                            hourlyData[hour]['LOGOS'].buyVolume += hourlyAmount;
                        } else {
                            hourlyData[hour]['LOGOS'].sellOrders++;
                            hourlyData[hour]['LOGOS'].sellVolume += hourlyAmount;
                        }
                    }
                }

                // Process CHAOS positions
                if (inputMint.equals(this.CHAOS) || outputMint.equals(this.CHAOS)) {
                    const isBuying = outputMint.equals(this.CHAOS);
                    const hourlyAmount = Number(amountPerCycle) * cyclesPerHour;

                    // Add to each hour's data
                    for (let hour = 0; hour < 24; hour++) {
                        if (isBuying) {
                            hourlyData[hour]['CHAOS'].buyOrders++;
                            hourlyData[hour]['CHAOS'].buyVolume += hourlyAmount;
                        } else {
                            hourlyData[hour]['CHAOS'].sellOrders++;
                            hourlyData[hour]['CHAOS'].sellVolume += hourlyAmount;
                        }
                    }
                }
            }

            // Store snapshots for each hour
            const currentState = this.storage.getState();
            for (const hour in hourlyData) {
                for (const token in hourlyData[hour]) {
                    if (token === 'LOGOS' || token === 'CHAOS') {
                        const chartDataPoint = {
                            ...hourlyData[hour][token],  // Spread first
                            timestamp: Number(hour)       // Then override timestamp
                        };
                        if (!currentState.chartData[token]) {
                            currentState.chartData[token] = [];
                        }
                        currentState.chartData[token].push(chartDataPoint);
                    }
                }
            }
            this.storage.updateState(currentState);
        } catch (error) {
            Logger.error('Error calculating daily DCA volumes:', error);
        }
    }

    private async withRetry<T>(operation: () => Promise<T>, retries = this.MAX_RETRIES): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
                return this.withRetry(operation, retries - 1);
            }
            throw error;
        }
    }

    private parseFormattedAmount(formattedAmount: string): number {
        try {
            // Extract just the number part
            const numberPart = formattedAmount.split(' ')[0];
            // Convert to float and ensure proper decimal handling
            const amount = parseFloat(numberPart);
            return isNaN(amount) ? 0 : amount;
        } catch (error) {
            Logger.error('Error parsing formatted amount:', error);
            return 0;
        }
    }

    private formatPositions(positions: ProgramDCAAccount[]): any[] {
        return positions
            .filter(pos => {
                const inputMint = pos.account.inputMint.toString();
                const outputMint = pos.account.outputMint.toString();
                // Log positions that get filtered out
                const isIncluded = (
                    inputMint === this.LOGOS.toString() || 
                    outputMint === this.LOGOS.toString() ||
                    inputMint === this.CHAOS.toString() || 
                    outputMint === this.CHAOS.toString()
                );
                if (!isIncluded) {
                    console.log('Filtered out position:', {
                        publicKey: pos.publicKey.toString(),
                        inputMint,
                        outputMint
                    });
                }
                return isIncluded;
            })
            .map(pos => {
                const inputMint = pos.account.inputMint.toString();
                const outputMint = pos.account.outputMint.toString();
                const isLogos = inputMint === this.LOGOS.toString() || outputMint === this.LOGOS.toString();
                
                // Calculate DCA amounts
                const totalAmount = pos.account.inDeposited.sub(pos.account.inWithdrawn);
                const amountPerCycle = pos.account.inAmountPerCycle;
                const totalCycles = totalAmount.div(amountPerCycle);
                const formattedAmount = Number(totalAmount.toString()) / Math.pow(10, 6);
                
                // Add detailed logging
                Logger.info('DCA Position Calculations:', {
                    publicKey: pos.publicKey.toString(),
                    token: isLogos ? 'LOGOS' : 'CHAOS',
                    rawValues: {
                        inDeposited: pos.account.inDeposited.toString(),
                        inWithdrawn: pos.account.inWithdrawn.toString(),
                        inAmountPerCycle: pos.account.inAmountPerCycle.toString()
                    },
                    calculations: {
                        totalRemainingRaw: totalAmount.toString(),
                        totalRemainingFormatted: formattedAmount,
                        amountPerCycleFormatted: Number(amountPerCycle.toString()) / Math.pow(10, 6),
                        remainingCycles: totalCycles.toNumber(),
                        cycleFrequency: pos.account.cycleFrequency.toNumber()
                    }
                });

                return {
                    token: isLogos ? 'LOGOS' : 'CHAOS',
                    type: outputMint === (isLogos ? this.LOGOS : this.CHAOS).toString() ? 'BUY' : 'SELL',
                    publicKey: pos.publicKey.toString(),
                    programId: 'DCAmK5w3m3yVnY8xdAhFYbFEHsocrfyxmXXYHEUqhxX6',
                    inputToken: this.TOKEN_INFO[inputMint]?.symbol || inputMint,
                    outputToken: this.TOKEN_INFO[outputMint]?.symbol || outputMint,
                    totalAmount: formattedAmount.toString(),
                    amountPerCycle: Number(amountPerCycle.toString()) / Math.pow(10, 6),
                    remainingCycles: totalCycles.toNumber(),
                    cycleFrequency: pos.account.cycleFrequency.toNumber(),
                    lastUpdate: Date.now(),
                    solscanUrl: `https://solscan.io/tx/${pos.publicKey.toString()}`
                };
            });
    }
}
 ` `