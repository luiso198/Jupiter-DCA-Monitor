import { NextResponse } from 'next/server';
import { getDcaOrders } from '@/lib/jupiter';

// Add runtime configuration
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Set timeout to maximum allowed for Hobby plan
export const maxDuration = 60; // Maximum allowed for Hobby plan

export async function GET() {
  try {
    console.error('DEPLOYMENT DEBUG - Starting DCA order fetch');
    const orders = await getDcaOrders();
    console.error('DEPLOYMENT DEBUG - Successfully fetched DCA orders:', { count: orders.length });
    
    return NextResponse.json({ 
      success: true, 
      data: orders,
      timestamp: Date.now()
    });
  } catch (error: any) {
    console.error('DEPLOYMENT DEBUG - Error fetching DCA orders:', {
      message: error?.message,
      name: error?.name,
      code: error?.code,
      stack: error?.stack
    });
    
    return NextResponse.json(
      { 
        success: false, 
        error: error?.message || 'Failed to process DCA orders',
        timestamp: Date.now()
      },
      { status: error?.message?.includes('timeout') ? 504 : 500 }
    );
  }
} 