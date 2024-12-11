'use client'

import { useEffect, useState, useRef } from 'react'
import Chart from 'chart.js/auto'
import Spinner from './Spinner'

interface TokenSectionProps {
  token: 'LOGOS' | 'CHAOS'
}

interface TokenStats {
  buyOrders: number
  sellOrders: number
  buyVolume: number
  sellVolume: number
}

interface Position {
  type: 'BUY' | 'SELL'
  token: string
  inputToken: string
  outputToken: string
  inputAmount: string
  totalAmount: string
  amountPerCycle: string
  remainingCycles: number
  cycleFrequency: number
  publicKey: string
  lastUpdate: number
}

export default function TokenSection({ token }: TokenSectionProps) {
  const [stats, setStats] = useState<TokenStats>({
    buyOrders: 0,
    sellOrders: 0,
    buyVolume: 0,
    sellVolume: 0
  })
  const [positions, setPositions] = useState<Position[]>([])
  const chartRef = useRef<Chart | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const response = await fetch('/api/dca/check');
        const data = await response.json();
        
        if (data.success && data.data.summary) {
          const tokenData = data.data.summary[token];
          setStats({
            buyOrders: tokenData.buyOrders,
            sellOrders: tokenData.sellOrders,
            buyVolume: tokenData.buyVolume,
            sellVolume: tokenData.sellVolume
          });

          // Set positions if they exist
          if (data.data.positions) {
            const tokenPositions = data.data.positions.filter(
              (pos: Position) => pos.token === token
            );
            setPositions(tokenPositions);
          }

          // Update chart with current values
          if (chartRef.current && chartRef.current.data) {
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
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (!canvasRef.current) return

    // Destroy existing chart
    if (chartRef.current) {
      chartRef.current.destroy()
    }

    // Create new chart
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return

    chartRef.current = new Chart(ctx, {
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
        }
      }
    })

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy()
      }
    }
  }, [token])

  return (
    <section className="token-section">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">{token} DCA</h2>
        {loading && <Spinner />}
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="stat-item">
          <div className="text-sm text-gray-400">Buy Orders</div>
          <div className="text-lg">{stats.buyOrders}</div>
        </div>
        <div className="stat-item">
          <div className="text-sm text-gray-400">Buy Volume</div>
          <div className="text-lg">{stats.buyVolume.toLocaleString()}</div>
        </div>
        <div className="stat-item">
          <div className="text-sm text-gray-400">Sell Orders</div>
          <div className="text-lg">{stats.sellOrders}</div>
        </div>
        <div className="stat-item">
          <div className="text-sm text-gray-400">Sell Volume</div>
          <div className="text-lg">{stats.sellVolume.toLocaleString()}</div>
        </div>
      </div>

      <div className="chart-container">
        <canvas ref={canvasRef}></canvas>
      </div>

      <div className="mt-5">
        {positions.map((position, index) => (
          <div key={index} className={`position-card ${position.type.toLowerCase()}`}>
            <div className="flex justify-between items-center">
              <strong>{position.type === 'BUY' ? '🟢' : '🔴'} {position.type}</strong>
              <span className="text-gray-400">
                {new Date(position.lastUpdate).toLocaleString()}
              </span>
            </div>
            <div className="mt-3 space-y-1">
              <div>Input: {position.inputToken} ({position.inputAmount})</div>
              <div>Output: {position.outputToken}</div>
              <div>Total Amount: {Number(position.totalAmount).toLocaleString()}</div>
              <div>Amount Per Cycle: {Number(position.amountPerCycle).toLocaleString()}</div>
              <div>Remaining Cycles: {position.remainingCycles}</div>
              <div>Frequency: Every {position.cycleFrequency}s</div>
            </div>
            <div className="mt-3">
              <a 
                href={`https://solscan.io/account/${position.publicKey}/dca?cluster=mainnet-beta`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300"
              >
                View on Solscan ↗
              </a>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
} 