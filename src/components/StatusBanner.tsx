'use client'

import { useState, useEffect } from 'react'

export default function StatusBanner() {
  const [isLive, setIsLive] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const handleRefresh = async () => {
    try {
      const response = await fetch('/api/dca/check')
      if (response.ok) {
        setIsLive(true)
        setLastUpdate(new Date())
      }
    } catch (error) {
      console.error('Error refreshing data:', error)
      setIsLive(false)
    }
  }

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    if (autoRefresh) {
      interval = setInterval(handleRefresh, 5000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [autoRefresh])

  return (
    <div className={`status-banner ${isLive ? 'live' : 'cached'}`}>
      <div className="status-text">
        {lastUpdate ? `Data as of ${lastUpdate.toLocaleString()}` : 'Loading...'}
      </div>
      <div className="flex gap-4 items-center">
        <button onClick={handleRefresh} className="button">
          Refresh Now
        </button>
        <div className="flex items-center gap-2">
          <label htmlFor="auto-refresh">Auto-refresh</label>
          <input
            type="checkbox"
            id="auto-refresh"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
        </div>
      </div>
    </div>
  )
} 