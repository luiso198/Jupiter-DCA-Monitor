"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
var dotenv = require("dotenv");
dotenv.config();
if (!process.env.TELEGRAM_BOT_TOKEN ||
    !process.env.TELEGRAM_CHAT_ID ||
    !process.env.SOLANA_RPC_ENDPOINT) {
    throw new Error('Missing required environment variables');
}
exports.config = {
    telegram: {
        botToken: process.env.TELEGRAM_BOT_TOKEN,
        chatId: process.env.TELEGRAM_CHAT_ID
    },
    solana: {
        rpcEndpoint: process.env.SOLANA_RPC_ENDPOINT
    }
};
