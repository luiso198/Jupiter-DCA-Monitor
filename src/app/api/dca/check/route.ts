import { NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { DCA } from '@jup-ag/dca-sdk';
import { ProgramDCAAccount } from '@/lib/types';
import { sendTelegramMessage } from '@/lib/telegram';

// Token addresses
const LOGOS = new PublicKey('HJUfqXoYjC653f2p33i84zdCC3jc4EuVnbruSe5kpump');
const CHAOS = new PublicKey('8SgNwESovnbG1oNEaPVhg6CR9mTMSK7jPvcYRe3wpump');

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

export async function GET() {
    let retries = MAX_RETRIES;
    
    while (retries > 0) {
        try {
            console.log('Fetching DCA orders with RPC:', process.env.NEXT_PUBLIC_RPC_ENDPOINT);
            const connection = new Connection(process.env.NEXT_PUBLIC_RPC_ENDPOINT!);
            const dca = new DCA(connection);
            
            const allDcaAccounts = await dca.getAll() as ProgramDCAAccount[];
            console.log(`Found ${allDcaAccounts.length} total DCA accounts`);
            
            const activePositions = allDcaAccounts.filter(pos => {
                if (!pos.account.inDeposited.gt(pos.account.inWithdrawn)) {
                    return false;
                }
                
                const inputMint = pos.account.inputMint.toString();
                const outputMint = pos.account.outputMint.toString();
                
                const isRelevant = (
                    inputMint === LOGOS.toString() || 
                    outputMint === LOGOS.toString() ||
                    inputMint === CHAOS.toString() || 
                    outputMint === CHAOS.toString()
                );

                if (isRelevant) {
                    console.log('Found relevant position:', {
                        inputMint,
                        outputMint,
                        deposited: pos.account.inDeposited.toString(),
                        withdrawn: pos.account.inWithdrawn.toString()
                    });
                }

                return isRelevant;
            });
            
            console.log(`Found ${activePositions.length} active LOGOS/CHAOS positions`);

            const summary = await generateDcaSummary(activePositions);
            console.log('Generated summary:', summary);

            // Send Telegram message
            try {
                await sendTelegramMessage(summary.message);
            } catch (error) {
                console.error('Error sending Telegram message:', error);
            }

            return NextResponse.json({ success: true, data: summary });
        } catch (error) {
            console.error(`Error checking DCA orders (${retries} retries left):`, error);
            retries--;
            
            if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                continue;
            }
            
            return NextResponse.json(
                { success: false, error: 'Failed to check DCA orders' },
                { status: 500 }
            );
        }
    }
}

async function generateDcaSummary(positions: ProgramDCAAccount[]) {
    const summary = {
        LOGOS: { buyOrders: 0, sellOrders: 0, buyVolume: 0, sellVolume: 0 },
        CHAOS: { buyOrders: 0, sellOrders: 0, buyVolume: 0, sellVolume: 0 }
    };

    // Calculate summary
    for (const pos of positions) {
        const inputMint = pos.account.inputMint.toString();
        const outputMint = pos.account.outputMint.toString();
        
        const totalAmount = pos.account.inDeposited.sub(pos.account.inWithdrawn);
        const volume = Number(totalAmount.toString()) / Math.pow(10, 6);

        // Process LOGOS positions
        if (inputMint === LOGOS.toString() || outputMint === LOGOS.toString()) {
            const isBuying = outputMint === LOGOS.toString();
            if (isBuying) {
                summary.LOGOS.buyOrders++;
                summary.LOGOS.buyVolume += volume;
            } else {
                summary.LOGOS.sellOrders++;
                summary.LOGOS.sellVolume += volume;
            }
        }

        // Process CHAOS positions
        if (inputMint === CHAOS.toString() || outputMint === CHAOS.toString()) {
            const isBuying = outputMint === CHAOS.toString();
            if (isBuying) {
                summary.CHAOS.buyOrders++;
                summary.CHAOS.buyVolume += volume;
            } else {
                summary.CHAOS.sellOrders++;
                summary.CHAOS.sellVolume += volume;
            }
        }
    }

    const message = [
        '🤖 Jupiter DCA Summary\n',
        '🔵 LOGOS',
        `Buy: ${summary.LOGOS.buyOrders} orders (${summary.LOGOS.buyVolume.toLocaleString()})`,
        `Sell: ${summary.LOGOS.sellOrders} orders (${summary.LOGOS.sellVolume.toLocaleString()})\n`,
        '🟣 CHAOS',
        `Buy: ${summary.CHAOS.buyOrders} orders (${summary.CHAOS.buyVolume.toLocaleString()})`,
        `Sell: ${summary.CHAOS.sellOrders} orders (${summary.CHAOS.sellVolume.toLocaleString()})`
    ].join('\n');

    return { 
        summary,
        message,
        positions: positions.map(pos => ({
            type: pos.account.outputMint.toString() === LOGOS.toString() || pos.account.outputMint.toString() === CHAOS.toString() ? 'BUY' : 'SELL',
            token: pos.account.inputMint.toString() === LOGOS.toString() || pos.account.outputMint.toString() === LOGOS.toString() ? 'LOGOS' : 'CHAOS',
            volume: Number(pos.account.inDeposited.sub(pos.account.inWithdrawn).toString()) / Math.pow(10, 6),
            publicKey: pos.publicKey.toString()
        }))
    };
} 