import { NextResponse } from 'next/server';

// Add runtime configuration
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

        // Just return a test response for now
        return NextResponse.json({ 
            success: true, 
            message: 'API endpoint responding',
            env: {
                hasRpcEndpoint: !!process.env.NEXT_PUBLIC_RPC_ENDPOINT,
                hasTelegramToken: !!process.env.TELEGRAM_BOT_TOKEN,
                hasTelegramChatId: !!process.env.TELEGRAM_CHAT_ID,
                nodeEnv: process.env.NODE_ENV
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