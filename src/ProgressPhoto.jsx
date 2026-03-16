/**
 * Single reusable progress-photo display. Uses global aspect ratio and optional crop.
 * Use everywhere a progress photo is shown (overview, gallery, compare, fullscreen).
 */
const DEFAULT_CROP = { x: 0, y: 0, scale: 1 }

export default function ProgressPhoto({ src, crop, className = '', onClick, children }) {
  const c = crop && typeof crop.scale === 'number' ? crop : DEFAULT_CROP
  const style = {
    aspectRatio: 'var(--progress-photo-ratio)',
  }

  return (
    <div
      className={`overflow-hidden relative bg-card ${className}`}
      style={style}
      onClick={onClick}
    >
      {src ? (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transform: `translate(${c.x}%, ${c.y}%) scale(${c.scale})`,
            transformOrigin: 'center',
          }}
        >
          <img
            src={src}
            alt=""
            className="w-full h-full object-cover min-w-full min-h-full"
          />
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  )
}

export { DEFAULT_CROP }
