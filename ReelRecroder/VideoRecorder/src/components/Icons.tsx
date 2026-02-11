import type { SVGProps } from 'react'

const iconProps = (props?: SVGProps<SVGSVGElement>) => ({
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  ...props,
})

export function IconRecord(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)} aria-hidden>
      <circle cx="12" cy="12" r="6" />
    </svg>
  )
}

export function IconStop(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)} aria-hidden>
      <rect x="6" y="6" width="12" height="12" />
    </svg>
  )
}

export function IconPlay(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)} aria-hidden>
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  )
}

export function IconPause(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)} aria-hidden>
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  )
}

export function IconDownload(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)} aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

export function IconType(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)} aria-hidden>
      <polyline points="4 7 4 4 20 4 20 7" />
      <line x1="9" y1="20" x2="15" y2="20" />
      <line x1="12" y1="4" x2="12" y2="20" />
    </svg>
  )
}

export function IconImage(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  )
}

export function IconX(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)} aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

export function IconTrash(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)} aria-hidden>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  )
}

export function IconWand(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)} aria-hidden>
      <path d="M15 4V2" />
      <path d="M15 16v-2" />
      <path d="M8 9h2" />
      <path d="M20 9h2" />
      <path d="M17.8 11.8L19 13" />
      <path d="M15 9h0" />
      <path d="M17.8 6.2L19 5" />
      <path d="m3 21 9-9" />
      <path d="M12.2 6.2 11 5" />
    </svg>
  )
}

export function IconRefresh(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)} aria-hidden>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}

export function IconCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)} aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export function IconEdit(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)} aria-hidden>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

export function IconThumbnail(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  )
}

export function IconExport(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)} aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

export function IconVideo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)} aria-hidden>
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  )
}

export function IconTranscript(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)} aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  )
}

export function IconSplit(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)} aria-hidden viewBox="0 0 24 24">
      <path d="M12 4v16M5 12h4M15 12h4" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
    </svg>
  )
}

export function IconLayers(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)} aria-hidden>
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
    </svg>
  )
}

export function IconCursor(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)} aria-hidden>
      <path d="M4 4l7 16 2.5-7.5L20 13 4 4z" />
    </svg>
  )
}

export function IconColor(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)} aria-hidden viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="6" r="1.5" />
      <circle cx="17" cy="10" r="1.5" />
      <circle cx="17" cy="14" r="1.5" />
      <circle cx="12" cy="18" r="1.5" />
      <circle cx="7" cy="14" r="1.5" />
      <circle cx="7" cy="10" r="1.5" />
    </svg>
  )
}

export function IconAudio(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)} aria-hidden viewBox="0 0 24 24">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  )
}

export function IconSafeZone(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)} aria-hidden viewBox="0 0 24 24">
      <rect x="2" y="2" width="20" height="20" rx="1" />
      <rect x="5" y="5" width="14" height="14" rx="1" strokeDasharray="2 1" />
    </svg>
  )
}

export function IconCamera(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)} aria-hidden viewBox="0 0 24 24">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}
