import { NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { DCA } from '@jup-ag/dca-sdk';
import { ProgramDCAAccount } from '@/lib/types';

// Add runtime configuration
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Token addresses
const LOGOS = new PublicKey('HJUfqXoYjC653f2p33i84zdCC3jc4EuVnbruSe5kpump');
const CHAOS = new PublicKey('8SgNwESovnbG1oNEaPVhg6CR9mTMSK7jPvcYRe3wpump');

// Initialize connection with longer timeout
const connection = new Connection(
    process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com',
    {
        commitment: 'confirmed',
        disableRetryOnRateLimit: false,
        confirmTransactionInitialTimeout: 30000
    }
);

const dca = new DCA(connection);

// Cache mechanism
let cachedData: any = null;
let lastFetch = 0;
const CACHE_DURATION = 30000; // 30 seconds

export async function GET() {
    console.error('DEPLOYMENT DEBUG - Starting DCA check');
    
    try {
        // Check cache first
        const now = Date.now();
        if (cachedData && (now - lastFetch) < CACHE_DURATION) {
            console.error('DEPLOYMENT DEBUG - Returning cached data');
            return NextResponse.json({ 
                success: true, 
                data: cachedData,
                cached: true,
                lastFetch
            });
        }

        // Test connection first
        console.error('DEPLOYMENT DEBUG - Testing connection');
        const connectionTest = await Promise.race([
            connection.getLatestBlockhash(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 10000))
        ]);

        console.error('DEPLOYMENT DEBUG - Connection successful, fetching accounts');
        
        // Fetch accounts with timeout
        const accountsPromise = dca.getAll();
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('DCA accounts fetch timeout')), 20000)
        );
        
        const accounts = await Promise.race([accountsPromise, timeoutPromise]) as ProgramDCAAccount[];
        
        // Process accounts
        const positions = accounts.filter((pos: ProgramDCAAccount) => {
            if (!pos.account.inDeposited.gt(pos.account.inWithdrawn)) return false;
            const inputMint = pos.account.inputMint.toString();
            const outputMint = pos.account.outputMint.toString();
            return (
                inputMint === LOGOS.toString() || 
                outputMint === LOGOS.toString() ||
                inputMint === CHAOS.toString() || 
                outputMint === CHAOS.toString()
            );
        });

        // Format data
        const formattedData = {
            summary: {
                LOGOS: { buyOrders: 0, sellOrders: 0, buyVolume: 0, sellVolume: 0 },
                CHAOS: { buyOrders: 0, sellOrders: 0, buyVolume: 0, sellVolume: 0 }
            },
            positions: positions.map((pos: ProgramDCAAccount) => {
                const inputMint = pos.account.inputMint.toString();
                const outputMint = pos.account.outputMint.toString();
                const totalAmount = pos.account.inDeposited.sub(pos.account.inWithdrawn);
                const volume = Number(totalAmount.toString()) / Math.pow(10, 6);

                const token = inputMint === LOGOS.toString() || outputMint === LOGOS.toString() ? 'LOGOS' : 'CHAOS';
                const type = outputMint === (token === 'LOGOS' ? LOGOS : CHAOS).toString() ? 'BUY' : 'SELL';

                // Update summary
                const summary = formattedData.summary[token];
                if (type === 'BUY') {
                    summary.buyOrders++;
                    summary.buyVolume += volume;
                } else {
                    summary.sellOrders++;
                    summary.sellVolume += volume;
                }

                return {
                    type,
                    token,
                    inputToken: inputMint === 'So11111111111111111111111111111111111111112' ? 'SOL' : token,
                    outputToken: outputMint === 'So11111111111111111111111111111111111111112' ? 'SOL' : token,
                    volume,
                    amountPerCycle: Number(pos.account.inAmountPerCycle.toString()) / Math.pow(10, 6),
                    remainingCycles: Math.floor(Number(totalAmount.toString()) / Number(pos.account.inAmountPerCycle.toString())),
                    cycleFrequency: pos.account.cycleFrequency.toNumber(),
                    publicKey: pos.publicKey.toString()
                };
            }),
            lastUpdate: Date.now()
        };

        // Update cache
        cachedData = formattedData;
        lastFetch = now;

        console.error('DEPLOYMENT DEBUG - Successfully processed data:', {
            positionCount: formattedData.positions.length,
            logosStats: formattedData.summary.LOGOS,
            chaosStats: formattedData.summary.CHAOS
        });

        return NextResponse.json({ 
            success: true, 
            data: formattedData,
            cached: false
        });
    } catch (error: any) {
        console.error('DEPLOYMENT DEBUG - Error processing request:', {
            message: error?.message,
            name: error?.name,
            code: error?.code,
            stack: error?.stack
        });

        // If we have cached data and hit an error, return cached data
        if (cachedData) {
            console.error('DEPLOYMENT DEBUG - Returning cached data after error');
            return NextResponse.json({ 
                success: true, 
                data: cachedData,
                cached: true,
                lastFetch,
                error: error?.message
            });
        }

        return NextResponse.json(
            { 
                success: false, 
                error: error?.message || 'Unknown error',
                timestamp: Date.now()
            },
            { status: error?.message?.includes('timeout') ? 504 : 500 }
        );
    }
} 