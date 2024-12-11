import { NextResponse } from 'next/server';
import { getDcaOrders } from '@/lib/jupiter';
import { sendTelegramMessage } from '@/lib/telegram';

export async function GET() {
  try {
    const orders = await getDcaOrders();
    // Format the orders into a readable message before sending
    const message = [
      'Jupiter DCA Orders:\n',
      ...orders.map(order => {
        const inputMint = order.account.inputMint.toString();
        const outputMint = order.account.outputMint.toString();
        const amount = order.account.inDeposited.sub(order.account.inWithdrawn).toString();
        return `Input: ${inputMint}\nOutput: ${outputMint}\nAmount: ${amount}`;
      })
    ].join('\n');
    
    await sendTelegramMessage(message);
    return NextResponse.json({ success: true, data: orders });
  } catch (error) {
    console.error('Error processing DCA orders:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process DCA orders' },
      { status: 500 }
    );
  }
} 