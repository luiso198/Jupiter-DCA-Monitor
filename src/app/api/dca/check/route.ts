import { NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { DCA } from '@jup-ag/dca-sdk';
import { sendTelegramMessage } from '@/lib/telegram';

// Token addresses
const LOGOS = new PublicKey('HJUfqXoYjC653f2p33i84zdCC3jc4EuVnbruSe5kpump');
const CHAOS = new PublicKey('8SgNwESovnbG1oNEaPVhg6CR9mTMSK7jPvcYRe3wpump');

export async function GET() {
    try {
        // Log environment check
        console.log('Environment check:', {
            hasRpcEndpoint: !!process.env.NEXT_PUBLIC_RPC_ENDPOINT,
            hasTelegramToken: !!process.env.TELEGRAM_BOT_TOKEN,
            hasTelegramChatId: !!process.env.TELEGRAM_CHAT_ID,
            nodeEnv: process.env.NODE_ENV
        });

        // Basic environment validation
        if (!process.env.NEXT_PUBLIC_RPC_ENDPOINT || !process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
            throw new Error('Missing required environment variables');
        }

        // Initialize and fetch data
        console.log('Connecting to RPC...');
        const connection = new Connection(process.env.NEXT_PUBLIC_RPC_ENDPOINT);
        const dca = new DCA(connection);
        
        console.log('Fetching accounts...');
        const accounts = await dca.getAll();
        console.log(`Found ${accounts.length} accounts`);

        // Send test message
        const message = `🤖 DCA Monitor Test\nFound ${accounts.length} total accounts`;
        console.log('Sending message:', message);
        await sendTelegramMessage(message);

        return NextResponse.json({ success: true, count: accounts.length });
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