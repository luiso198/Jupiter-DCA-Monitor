import { NextResponse } from 'next/server';
import { getDcaOrders } from '@/lib/jupiter';

// Add runtime configuration
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const orders = await getDcaOrders();
    return NextResponse.json({ success: true, data: orders });
  } catch (error) {
    console.error('Error processing DCA orders:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process DCA orders' },
      { status: 500 }
    );
  }
} 