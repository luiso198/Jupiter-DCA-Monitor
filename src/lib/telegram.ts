import axios from 'axios';

export async function sendTelegramMessage(message: string): Promise<boolean> {
    try {
        if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
            console.error('Telegram credentials not configured');
            return false;
        }

        const response = await axios.post(
            `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
            {
                chat_id: process.env.TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'HTML'
            }
        );

        return response.status === 200;
    } catch (error: any) {
        console.error('Telegram API Error:', error?.response?.data || error?.message || error);
        return false;
    }
}
