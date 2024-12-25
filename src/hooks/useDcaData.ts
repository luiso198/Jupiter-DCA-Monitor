'use client';

import { useEffect, useState } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { DCA } from '@jup-ag/dca-sdk';

// Token addresses
const LOGOS = new PublicKey('HJUfqXoYjC653f2p33i84zdCC3jc4EuVnbruSe5kpump');
const CHAOS = new PublicKey('8SgNwESovnbG1oNEaPVhg6CR9mTMSK7jPvcYRe3wpump');

// Types
interface DcaStats {
    buyOrders: number;
    sellOrders: number;
    buyVolume: number;
    sellVolume: number;
}

interface FormattedPosition {
    type: 'BUY' | 'SELL';
    token: 'LOGOS' | 'CHAOS';
    inputToken: string;
    outputToken: string;
    volume: number;
    amountPerCycle: number;
    remainingCycles: number;
    cycleFrequency: number;
    publicKey: string;
}

interface DcaData {
    summary: {
        LOGOS: DcaStats;
        CHAOS: DcaStats;
    };
    positions: FormattedPosition[];
    lastUpdate: number;
}

interface ProgramDCAAccount {
    publicKey: PublicKey;
    account: {
        user: PublicKey;
        inputMint: PublicKey;
        outputMint: PublicKey;
        inDeposited: { gt: (other: any) => boolean; sub: (other: any) => any; toString: () => string };
        inWithdrawn: { toString: () => string };
        inAmountPerCycle: { toString: () => string };
        cycleFrequency: { toNumber: () => number };
    };
}

export function useDcaData(refreshInterval = 5000) {
    const [data, setData] = useState<DcaData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let connection: Connection | null = null;
        let dca: DCA | null = null;
        let mounted = true;

        async function fetchData() {
            try {
                if (!connection) {
                    connection = new Connection(
                        process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://mainnet.helius-rpc.com/?api-key=aef2a726-33bc-4da3-abdd-5dd1b9e09978',
                        {
                            commitment: 'confirmed',
                            disableRetryOnRateLimit: false
                        }
                    );
                    dca = new DCA(connection);
                }

                // Fetch accounts
                const accounts = await dca!.getAll() as ProgramDCAAccount[];

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
                const formattedData: DcaData = {
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

                if (mounted) {
                    setData(formattedData);
                    setError(null);
                }
            } catch (err: any) {
                console.error('Error fetching DCA data:', err);
                if (mounted) {
                    setError(err.message || 'Failed to fetch DCA data');
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        // Initial fetch
        fetchData();

        // Set up polling
        const interval = setInterval(fetchData, refreshInterval);

        // Cleanup
        return () => {
            mounted = false;
            clearInterval(interval);
            // Connection doesn't need to be cleaned up
            connection = null;
        };
    }, [refreshInterval]);

    return { data, loading, error };
} 
