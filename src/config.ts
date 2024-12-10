import * as dotenv from 'dotenv';
import * as path from 'path';
import { Logger } from './logger';

// Try to load from project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Debug logging
Logger.debug('Current directory:', __dirname);
Logger.debug('Environment variables loaded:', {
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ? 'exists' : 'missing',
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID ? 'exists' : 'missing',
    SOLANA_RPC_ENDPOINT: process.env.SOLANA_RPC_ENDPOINT ? 'exists' : 'missing'
});

if (!process.env.TELEGRAM_BOT_TOKEN || 
    !process.env.TELEGRAM_CHAT_ID || 
    !process.env.SOLANA_RPC_ENDPOINT) {
    throw new Error('Missing required environment variables');
}

export const config = {
    telegram: {
        botToken: process.env.TELEGRAM_BOT_TOKEN || '',
        chatId: process.env.TELEGRAM_CHAT_ID || ''
    },
    solana: {
        rpcEndpoint: process.env.SOLANA_RPC_ENDPOINT || ''
    },
    logLevel: 'DEBUG'
};
