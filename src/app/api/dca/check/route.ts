import { NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { DCA } from '@jup-ag/dca-sdk';

// Add runtime configuration
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Token addresses
const LOGOS = new PublicKey('HJUfqXoYjC653f2p33i84zdCC3jc4EuVnbruSe5kpump');
const CHAOS = new PublicKey('8SgNwESovnbG1oNEaPVhg6CR9mTMSK7jPvcYRe3wpump');

export async function GET() {
    console.error('DEPLOYMENT TEST - Starting DCA check with commit comments enabled');
    
    try {
        // Log environment variables (safely)
        const envVars: Record<string, string> = {};
        Object.keys(process.env).forEach(key => {
            const value = process.env[key];
            if (value) {
                envVars[key] = key.includes('KEY') || key.includes('SECRET') || key.includes('TOKEN') 
                    ? '[REDACTED]' 
                    : value;
            }
        });
        
        console.error('DEPLOYMENT DEBUG - Environment:', {
            hasRpcEndpoint: !!process.env.NEXT_PUBLIC_RPC_ENDPOINT,
            nodeEnv: process.env.NODE_ENV,
            vercelEnv: process.env.VERCEL_ENV,
            allVars: envVars
        });

        // Validate RPC endpoint
        if (!process.env.NEXT_PUBLIC_RPC_ENDPOINT) {
            console.error('DEPLOYMENT DEBUG - Error: RPC endpoint not configured');
            throw new Error('RPC endpoint not configured');
        }

        // Initialize connection with more logging
        console.error('DEPLOYMENT DEBUG - Initializing Solana connection...');
        const connection = new Connection(process.env.NEXT_PUBLIC_RPC_ENDPOINT);
        
        // Test connection
        console.error('DEPLOYMENT DEBUG - Testing Solana connection...');
        try {
            const blockHash = await connection.getLatestBlockhash();
            console.error('DEPLOYMENT DEBUG - Successfully connected to Solana:', {
                blockHash: blockHash.blockhash.substring(0, 10) + '...',
                lastValidBlockHeight: blockHash.lastValidBlockHeight
            });
        } catch (error: any) {
            console.error('DEPLOYMENT DEBUG - Failed to connect to Solana:', {
                message: error?.message || 'Unknown error',
                code: error?.code,
                stack: error?.stack
            });
            throw new Error(`Failed to connect to Solana network: ${error?.message || 'Unknown error'}`);
        }
        
        const dca = new DCA(connection);
        
        // Fetch accounts
        const accounts = await dca.getAll();
        console.log(`Found ${accounts.length} DCA accounts`);
        
        // Filter relevant positions
        const positions = accounts.filter(pos => {
            if (!pos.account.inDeposited.gt(pos.account.inWithdrawn)) {
                return false;
            }
            
            const inputMint = pos.account.inputMint.toString();
            const outputMint = pos.account.outputMint.toString();
            
            return (
                inputMint === LOGOS.toString() || 
                outputMint === LOGOS.toString() ||
                inputMint === CHAOS.toString() || 
                outputMint === CHAOS.toString()
            );
        });

        // Format positions for UI
        const formattedPositions = positions.map(pos => {
            const inputMint = pos.account.inputMint.toString();
            const outputMint = pos.account.outputMint.toString();
            const totalAmount = pos.account.inDeposited.sub(pos.account.inWithdrawn);
            const volume = Number(totalAmount.toString()) / Math.pow(10, 6);

            // Determine token and type
            const token = inputMint === LOGOS.toString() || outputMint === LOGOS.toString() ? 'LOGOS' : 'CHAOS';
            const type = outputMint === (token === 'LOGOS' ? LOGOS : CHAOS).toString() ? 'BUY' : 'SELL';

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
        });

        // Calculate summary
        const summary = formattedPositions.reduce((acc, pos) => {
            if (pos.token === 'LOGOS') {
                if (pos.type === 'BUY') {
                    acc.LOGOS.buyOrders++;
                    acc.LOGOS.buyVolume += pos.volume;
                } else {
                    acc.LOGOS.sellOrders++;
                    acc.LOGOS.sellVolume += pos.volume;
                }
            } else {
                if (pos.type === 'BUY') {
                    acc.CHAOS.buyOrders++;
                    acc.CHAOS.buyVolume += pos.volume;
                } else {
                    acc.CHAOS.sellOrders++;
                    acc.CHAOS.sellVolume += pos.volume;
                }
            }
            return acc;
        }, {
            LOGOS: { buyOrders: 0, sellOrders: 0, buyVolume: 0, sellVolume: 0 },
            CHAOS: { buyOrders: 0, sellOrders: 0, buyVolume: 0, sellVolume: 0 }
        });

        return NextResponse.json({ 
            success: true, 
            data: {
                summary,
                positions: formattedPositions,
                lastUpdate: Date.now()
            }
        });
    } catch (error: any) {
        console.error('Error:', {
            message: error?.message,
            name: error?.name,
            code: error?.code
        });
        
        return NextResponse.json(
            { 
                success: false, 
                error: error?.message || 'Unknown error'
            },
            { status: 500 }
        );
    }
} 