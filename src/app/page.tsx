'use client'

import StatusBanner from '@/components/StatusBanner'
import TokenSection from '@/components/TokenSection'

export default function Home() {
  return (
    <div className="container max-w-[95%] mx-auto p-5">
      <StatusBanner />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <TokenSection token="LOGOS" />
        <TokenSection token="CHAOS" />
      </div>
    </div>
  )
} 