import { DCA } from '@jup-ag/dca-sdk';
import { Connection, ConnectionConfig } from '@solana/web3.js';

const config: ConnectionConfig = {
  commitment: 'confirmed',
  disableRetryOnRateLimit: false,
  httpHeaders: {
    'Content-Type': 'application/json',
  }
};

const connection = new Connection(
  process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com',
  config
);

const dca = new DCA(connection);

export async function getDcaOrders() {
    try {
        // Test connection first
        await connection.getLatestBlockhash();
        
        // Get all DCA orders
        const orders = await dca.getAll();
        return orders;
    } catch (error) {
        console.error('Error fetching DCA orders:', error);
        // Optionally retry with a different RPC
        throw error;
    }
} 