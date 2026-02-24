import React from 'react'

interface Props {
  lastCapturedAt: string | null
}

function formatRelative(isoStr: string | null): string {
  if (!isoStr) return 'never'
  const diff = Date.now() - new Date(isoStr).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return 'less than an hour ago'
  if (hours === 1) return '1 hour ago'
  if (hours < 24) return `${hours} hours ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days !== 1 ? 's' : ''} ago`
}

export function StalenessWarning({ lastCapturedAt }: Props) {
  return (
    <div className="staleness-warning" role="alert">
      <span className="staleness-icon">⚠️</span>
      <span>
        {lastCapturedAt
          ? `Data is stale — last captured ${formatRelative(lastCapturedAt)}.`
          : 'No data captured yet.'
        }
        {' '}Run <code>pnpm scrape</code> or wait for the 11:55 PM scheduled run.
      </span>
    </div>
  )
}
