import { MUSCLE_GROUPS } from './exerciseLibrary'

export default function MuscleIcon({ muscle, size = 20, className = '' }) {
  const mg = MUSCLE_GROUPS[muscle]
  if (!mg) return null
  const color = mg.color

  const icons = {
    chest: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: size, height: size, stroke: color }}>
        <path d="M6 4C6 4 4 6 4 10v2h16v-2c0-4-2-6-2-6"/>
        <line x1="12" y1="5" x2="12" y2="12"/>
        <path d="M7 7c1.5 1.5 3 2.5 5 2.5"/>
        <path d="M17 7c-1.5 1.5-3 2.5-5 2.5"/>
      </svg>
    ),
    back: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: size, height: size, stroke: color }}>
        <line x1="12" y1="4" x2="12" y2="20"/>
        <path d="M5 6h14"/>
        <path d="M5 6l2 14"/>
        <path d="M19 6l-2 14"/>
        <path d="M8 11h8"/>
      </svg>
    ),
    legs: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: size, height: size, stroke: color }}>
        <path d="M9 3c-.5 3-1 6-.5 9l1 4.5"/>
        <path d="M15 3c.5 3 .5 6 0 9l-1 4.5"/>
        <path d="M9.5 16.5c-.5 1.5-.5 3 .5 4.5"/>
        <path d="M14 16.5c.5 1.5.5 3-.5 4.5"/>
        <path d="M9.5 12.5h5"/>
        <path d="M9 3h6"/>
      </svg>
    ),
    shoulders: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: size, height: size, stroke: color }}>
        <path d="M10 6h4"/>
        <path d="M10 6C7 6 4 8 4 12"/>
        <path d="M14 6c3 0 6 2 6 6"/>
        <line x1="4" y1="12" x2="4" y2="18"/>
        <line x1="20" y1="12" x2="20" y2="18"/>
        <path d="M10 8L6 10"/>
        <path d="M14 8l4 2"/>
        <path d="M6 10v6"/>
        <path d="M18 10v6"/>
      </svg>
    ),
    arms: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: size, height: size, stroke: color }}>
        <path d="M5 20L7 13"/>
        <path d="M7 13c-1-2 0-4 2-5"/>
        <path d="M9 8l5-2.5"/>
        <path d="M8 20l1-6"/>
        <path d="M9 14l4-5"/>
        <path d="M13 9l3-3"/>
        <rect x="14.5" y="3.5" width="4" height="3" rx="1.5" transform="rotate(-25 16.5 5)"/>
        <path d="M7.5 11c.5-1 1.5-2.5 2.5-2.5"/>
      </svg>
    ),
    core: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: size, height: size, stroke: color }}>
        <rect x="6" y="4" width="12" height="16" rx="3"/>
        <line x1="12" y1="4" x2="12" y2="20"/>
        <line x1="6" y1="8.5" x2="18" y2="8.5"/>
        <line x1="6" y1="13" x2="18" y2="13"/>
        <line x1="7" y1="17" x2="17" y2="17"/>
      </svg>
    ),
    cardio: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: size, height: size, stroke: color }}>
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/>
        <path d="M3.5 12h3l2-4 3 8 2-4h3"/>
      </svg>
    ),
    mobility: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: size, height: size, stroke: color }}>
        <circle cx="12" cy="5" r="2.5"/>
        <path d="M12 7.5v4"/>
        <path d="M12 11.5l-5 6"/>
        <path d="M12 11.5l5 6"/>
        <path d="M8 9l-4 3"/>
        <path d="M16 9l4 3"/>
      </svg>
    ),
  }

  return (
    <div className={className} style={{ width: size + 16, height: size + 16, borderRadius: size > 16 ? 10 : 8, background: mg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {icons[muscle]}
    </div>
  )
}
