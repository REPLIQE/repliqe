import { Z_OVERLAY } from './zLayers'
import { BOTTOM_SHEET_INSET, CENTER_SHEET_INSET } from './spacingTokens'

/**
 * Top 10 #1 — Fælles modal/bottom-sheet skal: backdrop + panel + (valgfri) handle.
 * Top 10 #3 — Standard `zClass` er over bundmenu (`z-30`); se `zLayers.js`.
 *
 * @param {'bottom'|'center'} align — bund-sheet vs centreret dialog (max-w-sm typisk via maxWidthClass).
 * @param {'scrollable'|'flex'} layout
 * @param {'default'|'none'} padding — none: intet indvendig px/pt (fx Pricing, workout stack).
 * @param {string} [surfaceClass] — overstyr baggrund (fx Recovery: bg-[#111925]).
 * @param {string} [outerClassName] — fx sm:items-center sm:p-4 (ProgressPhotoEditor).
 * @param {boolean} [closeOnBackdrop=true] — false for bekræftelsesdialoger uden “tap udenfor luk”.
 */
export default function BottomSheet({
  onClose,
  closeOnBackdrop = true,
  children,
  variant = 'page',
  zClass = Z_OVERLAY,
  layout = 'scrollable',
  showHandle = null,
  padding = 'default',
  backdropClassName = 'bg-black/60 backdrop-blur-[4px]',
  panelClassName = '',
  outerClassName = '',
  align = 'bottom',
  maxWidthClass = 'max-w-md',
  role,
  ariaModal,
  ariaLabelledBy,
  surfaceClass,
}) {
  const showHandleResolved = showHandle === null ? align === 'bottom' : showHandle
  const alignOuter =
    align === 'center'
      ? 'items-center justify-center px-6 py-6 sm:py-8'
      : 'items-end justify-center'

  const panelBg = surfaceClass ?? (variant === 'card' ? 'bg-card' : 'bg-page')
  const panelShape = align === 'center' ? 'rounded-[18px] border border-border shadow-xl' : 'rounded-t-[20px]'

  const layoutCls =
    layout === 'flex'
      ? align === 'center'
        ? 'max-h-[min(90vh,calc(100vh-3rem))] flex flex-col min-h-0'
        : 'max-h-[95vh] flex flex-col min-h-0'
      : align === 'center'
        ? 'max-h-[min(90vh,calc(100vh-3rem))] overflow-y-auto min-h-0'
        : 'max-h-[95vh] overflow-y-auto min-h-0'

  let paddingCls = ''
  if (padding === 'none') {
    paddingCls = 'pt-0 px-0'
  } else if (align === 'center') {
    paddingCls = CENTER_SHEET_INSET
  } else {
    paddingCls = BOTTOM_SHEET_INSET
  }

  const safePb = 'pb-[max(1.25rem,env(safe-area-inset-bottom))]'

  return (
    <div
      className={`fixed inset-0 ${backdropClassName} ${zClass} flex ${alignOuter} ${outerClassName}`.trim()}
      onClick={closeOnBackdrop && onClose ? onClose : undefined}
      role="presentation"
    >
      <div
        className={`${maxWidthClass} w-full ${panelBg} ${panelShape} ${paddingCls} ${safePb} ${layoutCls} ${panelClassName}`.trim()}
        onClick={(e) => e.stopPropagation()}
        role={role}
        aria-modal={ariaModal}
        aria-labelledby={ariaLabelledBy}
      >
        {showHandleResolved && align === 'bottom' && (
          <div className="w-9 h-1 bg-handle rounded mx-auto mb-4 shrink-0" aria-hidden />
        )}
        {children}
      </div>
    </div>
  )
}
