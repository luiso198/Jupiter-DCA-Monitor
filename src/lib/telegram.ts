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

const TELEGRAM_BASE_URL = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const MIN_INTERVAL = 1000; // 1 second minimum between messages

let lastMessageTime = 0;
const sentMessages = new Set<string>();
const MESSAGE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

// Clean up old messages
const cleanupOldMessages = () => {
    const now = Date.now();
    Array.from(sentMessages).forEach(entry => {
        const [, timestamp] = entry.split('|');
        if (now - parseInt(timestamp) > MESSAGE_EXPIRY) {
            sentMessages.delete(entry);
        }
    });
};

export async function sendTelegramMessage(message: string): Promise<boolean> {
    try {
        if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
            console.error('Telegram credentials not configured');
            return false;
        }

        const now = Date.now();
        const messageKey = `${message}|${now}`;

        // Check for recent duplicate messages (within 5 minutes)
        const recentMessages = Array.from(sentMessages)
            .filter(entry => {
                const [storedMessage, timestamp] = entry.split('|');
                return storedMessage === message && 
                       now - parseInt(timestamp) < 5 * 60 * 1000;
            });

        if (recentMessages.length > 0) {
            console.log('Duplicate message prevented');
            return false;
        }

        // Add to sent messages set
        sentMessages.add(messageKey);
        cleanupOldMessages();

        // Respect rate limiting
        const timeSinceLastMessage = now - lastMessageTime;
        if (timeSinceLastMessage < MIN_INTERVAL) {
            await new Promise(resolve => 
                setTimeout(resolve, MIN_INTERVAL - timeSinceLastMessage)
            );
        }

        const response = await axios.post<TelegramResponse>(
            `${TELEGRAM_BASE_URL}/sendMessage`,
            {
                chat_id: process.env.TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'HTML'
            }
        );

        lastMessageTime = Date.now();

        if (!response.data.ok) {
            throw new TelegramError('Telegram API returned not OK');
        }

        return true;

    } catch (error: any) {
        // Simple error handling based on response structure
        if (error?.response?.status) {
            if (error.response.status === 429) {
                const retryAfter = error.response.data?.parameters?.retry_after || 30;
                console.error(`Rate limited by Telegram. Retry after ${retryAfter} seconds`);
                throw new TelegramError('Rate limited', 429, retryAfter);
            }
            console.error('Telegram API Error:', {
                status: error.response.status,
                message: error.message,
                timestamp: new Date().toISOString()
            });
        } else {
            console.error('Unexpected error:', error);
        }
        return false;
    }
} 