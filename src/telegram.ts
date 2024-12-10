import axios from 'axios';
import { config } from './config';
import { Logger } from './logger';

interface TelegramResponse {
    ok: boolean;
    parameters?: {
        retry_after?: number;
    };
}

interface QueuedMessage {
    message: string;
    timestamp: number;
    retryAfter?: number;
}

export class TelegramService {
    private readonly baseUrl: string;
    private messageHandlers: ((message: string) => void)[] = [];
    private messageQueue: QueuedMessage[] = [];
    private isProcessingQueue = false;
    private lastMessageTime = 0;
    private readonly MIN_INTERVAL = 1000; // Minimum 1 second between messages
    private sentMessages = new Set<string>();
    private readonly MESSAGE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
    
    constructor() {
        this.baseUrl = `https://api.telegram.org/bot${config.telegram.botToken}`;
        // Clean up old messages periodically
        setInterval(() => this.cleanupOldMessages(), this.MESSAGE_EXPIRY);
    }

    private cleanupOldMessages() {
        const now = Date.now();
        Array.from(this.sentMessages).forEach(entry => {
            const [message, timestamp] = entry.split('|');
            if (now - parseInt(timestamp) > this.MESSAGE_EXPIRY) {
                this.sentMessages.delete(entry);
            }
        });
    }

    onMessage(handler: (message: string) => void) {
        this.messageHandlers.push(handler);
    }

    async sendAlert(message: string): Promise<boolean> {
        const now = Date.now();
        const messageKey = `${message}|${now}`;
        
        // Check if we've sent this message recently
        const recentMessages = Array.from(this.sentMessages)
            .filter(entry => {
                const [storedMessage, timestamp] = entry.split('|');
                return storedMessage === message && 
                       now - parseInt(timestamp) < 5 * 60 * 1000; // Within last 5 minutes
            });

        if (recentMessages.length > 0) {
            return false;
        }

        // Add to sent messages set
        this.sentMessages.add(messageKey);

        // Add to queue
        this.messageQueue.push({
            message,
            timestamp: now
        });

        // Start processing queue if not already running
        if (!this.isProcessingQueue) {
            this.processQueue();
        }

        return true;
    }

    private async processQueue() {
        if (this.isProcessingQueue) return;
        this.isProcessingQueue = true;

        while (this.messageQueue.length > 0) {
            const now = Date.now();
            const timeSinceLastMessage = now - this.lastMessageTime;

            // Respect minimum interval
            if (timeSinceLastMessage < this.MIN_INTERVAL) {
                await new Promise(resolve => setTimeout(resolve, this.MIN_INTERVAL - timeSinceLastMessage));
            }

            const message = this.messageQueue.shift();
            if (!message) continue;

            try {
                const response = await axios.post<TelegramResponse>(`${this.baseUrl}/sendMessage`, {
                    chat_id: config.telegram.chatId,
                    text: message.message,
                    parse_mode: 'HTML'
                });

                this.lastMessageTime = Date.now();
                
                // Notify handlers
                this.messageHandlers.forEach(handler => handler(message.message));

                // Small delay between successful messages
                await new Promise(resolve => setTimeout(resolve, this.MIN_INTERVAL));

            } catch (error: any) {
                if (error.response?.status === 429) {
                    const retryAfter = error.response.data?.parameters?.retry_after || 30;
                    // Put message back in queue
                    this.messageQueue.unshift({
                        ...message,
                        retryAfter: retryAfter
                    });

                    // Wait for retry_after period
                    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                } else {
                    Logger.error('Telegram API Error:', {
                        status: error.response?.status,
                        message: error.message,
                        timestamp: new Date().toISOString()
                    });
                }
            }
        }

        this.isProcessingQueue = false;
    }
}
