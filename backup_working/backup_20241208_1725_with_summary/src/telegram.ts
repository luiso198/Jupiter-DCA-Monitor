import axios from 'axios';
import { config } from './config';

interface TelegramResponse {
    ok: boolean;
}

export class TelegramService {
    private readonly baseUrl: string;
    
    constructor() {
        this.baseUrl = `https://api.telegram.org/bot${config.telegram.botToken}`;
    }

    async sendAlert(message: string): Promise<boolean> {
        try {
            const response = await axios.post<TelegramResponse>(`${this.baseUrl}/sendMessage`, {
                chat_id: config.telegram.chatId,
                text: message,
                parse_mode: 'HTML'
            });
            
            return response.data.ok;
        } catch (error) {
            console.error('Failed to send Telegram alert:', error);
            return false;
        }
    }
}
