'use client'

import { useRef, useEffect } from 'react';
import { Chart, ChartConfiguration } from 'chart.js/auto';
import Spinner from './Spinner';
import { useDcaData } from '@/hooks/useDcaData';

interface TokenSectionProps {
    token: 'LOGOS' | 'CHAOS';
}

export default function TokenSection({ token }: TokenSectionProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const chartRef = useRef<Chart | null>(null);
    const { data, loading, error } = useDcaData();

    // Initialize chart
    useEffect(() => {
        if (!canvasRef.current) return;

        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        const config: ChartConfiguration = {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Buy Volume',
                        borderColor: '#4CAF50',
                        backgroundColor: 'rgba(76, 175, 80, 0.1)',
                        data: [],
                        tension: 0.4,
                        fill: true,
                        borderWidth: 2
                    },
                    {
                        label: 'Sell Volume',
                        borderColor: '#f44336',
                        backgroundColor: 'rgba(244, 67, 54, 0.1)',
                        data: [],
                        tension: 0.4,
                        fill: true,
                        borderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 0
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.8)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.8)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            color: 'white',
                            font: {
                                size: 12
                            }
                        }
                    }
                }
            }
        };

        chartRef.current = new Chart(ctx, config);

        return () => {
            if (chartRef.current) {
                chartRef.current.destroy();
                chartRef.current = null;
            }
        };
    }, []);

    // Update chart with new data
    useEffect(() => {
        if (!chartRef.current || !data) return;

        const tokenData = data.summary[token];
        const now = new Date();
        const timeLabel = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;

        // Add new data point
        if (chartRef.current.data.labels && Array.isArray(chartRef.current.data.labels)) {
            chartRef.current.data.labels.push(timeLabel);

            // Keep only last 24 data points
            if (chartRef.current.data.labels.length > 24) {
                chartRef.current.data.labels.shift();
                chartRef.current.data.datasets[0].data.shift();
                chartRef.current.data.datasets[1].data.shift();
            }
        }

        // Update datasets
        if (chartRef.current.data.datasets[0].data && chartRef.current.data.datasets[1].data) {
            chartRef.current.data.datasets[0].data.push(tokenData.buyVolume);
            chartRef.current.data.datasets[1].data.push(tokenData.sellVolume);
        }

        chartRef.current.update();
    }, [data, token]);

    if (error) {
        return (
            <div className="p-4 bg-red-500/10 rounded-lg">
                <p className="text-red-500">Error: {error}</p>
            </div>
        );
    }

    const tokenData = data?.summary[token] || {
        buyOrders: 0,
        sellOrders: 0,
        buyVolume: 0,
        sellVolume: 0
    };

    const positions = data?.positions.filter(pos => pos.token === token) || [];

    return (
        <section className="token-section">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">{token} DCA</h2>
                {loading && <Spinner />}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div className="stat-item">
                    <div className="text-sm text-gray-400">Buy Orders</div>
                    <div className="text-lg">{tokenData.buyOrders}</div>
                </div>
                <div className="stat-item">
                    <div className="text-sm text-gray-400">Buy Volume</div>
                    <div className="text-lg">{tokenData.buyVolume.toLocaleString()}</div>
                </div>
                <div className="stat-item">
                    <div className="text-sm text-gray-400">Sell Orders</div>
                    <div className="text-lg">{tokenData.sellOrders}</div>
                </div>
                <div className="stat-item">
                    <div className="text-sm text-gray-400">Sell Volume</div>
                    <div className="text-lg">{tokenData.sellVolume.toLocaleString()}</div>
                </div>
            </div>

            <div className="chart-container mt-4">
                <canvas ref={canvasRef}></canvas>
            </div>

            <div className="positions-container mt-4 space-y-4">
                {positions.map((position) => (
                    <div 
                        key={position.publicKey}
                        className={`position-card ${position.type.toLowerCase()}`}
                    >
                        <div className="flex justify-between items-center">
                            <span className="font-bold">
                                {position.type === 'BUY' ? '🟢' : '🔴'} {position.type}
                            </span>
                            <a 
                                href={`https://solscan.io/account/${position.publicKey}/dca?cluster=mainnet-beta`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300"
                            >
                                View on Solscan ↗
                            </a>
                        </div>
                        <div className="mt-2 space-y-1">
                            <div>Input: {position.inputToken}</div>
                            <div>Output: {position.outputToken}</div>
                            <div>Volume: {position.volume.toLocaleString()}</div>
                            <div>Amount Per Cycle: {position.amountPerCycle.toLocaleString()}</div>
                            <div>Remaining Cycles: {position.remainingCycles}</div>
                            <div>Frequency: Every {position.cycleFrequency}s</div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
} 