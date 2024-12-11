import axios from 'axios';

interface TelegramResponse {
    ok: boolean;
    parameters?: {
        retry_after?: number;
    };
}

class TelegramError extends Error {
    constructor(message: string, public status?: number, public retryAfter?: number) {
        super(message);
        this.name = 'TelegramError';
    }
}

// Track sent messages to prevent duplicates
const sentMessages = new Set<string>();
const MESSAGE_EXPIRY = 5 * 60 * 1000; // 5 minutes
let lastMessageTime = 0;
const MIN_INTERVAL = 1000; // 1 second

export async function sendTelegramMessage(message: string): Promise<boolean> {
    try {
        if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
            console.error('Telegram credentials not configured');
            return false;
        }

        const now = Date.now();
        const messageKey = `${message}|${now}`;

        // Check for recent duplicates
        const isDuplicate = Array.from(sentMessages).some(entry => {
            const [storedMessage, timestamp] = entry.split('|');
            return storedMessage === message && 
                   now - parseInt(timestamp) < MESSAGE_EXPIRY;
        });

        if (isDuplicate) {
            console.log('Duplicate message prevented');
            return false;
        }

        // Rate limiting
        const timeSinceLastMessage = now - lastMessageTime;
        if (timeSinceLastMessage < MIN_INTERVAL) {
            await new Promise(resolve => 
                setTimeout(resolve, MIN_INTERVAL - timeSinceLastMessage)
            );
        }

        const response = await axios.post<TelegramResponse>(
            `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
            {
                chat_id: process.env.TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'HTML'
            }
        );

        lastMessageTime = Date.now();
        sentMessages.add(messageKey);

        // Cleanup old messages
        const now2 = Date.now();
        Array.from(sentMessages).forEach(entry => {
            const [, timestamp] = entry.split('|');
            if (now2 - parseInt(timestamp) > MESSAGE_EXPIRY) {
                sentMessages.delete(entry);
            }
        });

        return true;
    } catch (error: any) {
        console.error('Telegram API Error:', error);
        return false;
    }
}
