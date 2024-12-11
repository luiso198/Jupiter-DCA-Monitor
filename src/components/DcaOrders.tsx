'use client';

import { useEffect, useState } from 'react';
import type { DcaOrder } from '@/lib/types';

export default function DcaOrders() {
    const [orders, setOrders] = useState<DcaOrder[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchOrders() {
            try {
                const response = await fetch('/api/dca');
                const data = await response.json();
                if (data.success) {
                    setOrders(data.data);
                }
            } catch (error) {
                console.error('Error fetching orders:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchOrders();
    }, []);

    if (loading) return <div>Loading...</div>;

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">DCA Orders</h1>
            <div className="space-y-4">
                {orders.map((order, index) => (
                    <div key={index} className="border p-4 rounded">
                        <pre>{JSON.stringify(order, null, 2)}</pre>
                    </div>
                ))}
            </div>
        </div>
    );
} 