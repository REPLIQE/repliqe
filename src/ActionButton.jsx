import { forwardRef } from 'react'
import { MOTION_DURATION, MOTION_EASE, MOTION_TRANSITION_INTERACTIVE } from './motionTokens'

/** Stronger ring for WCAG contrast on primary/success fills; offset matches page bg */
const focusRing =
  'outline-none focus-visible:ring-2 focus-visible:ring-[var(--a11y-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--a11y-focus-ring-offset)]'

const motionColors = `${MOTION_DURATION} ${MOTION_EASE}`

/**
 * Top 10 #2 — Knap-hierarki: primær / sekundær / tertiær (+ success / danger / outline-success / muted til særlige flows).
 */
const ActionButton = forwardRef(function ActionButton(
  {
    variant = 'primary',
    size = 'md',
    fullWidth = true,
    className = '',
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref
) {
  const widthCls = fullWidth ? 'w-full' : ''

  const sizeCls =
    size === 'lg'
      ? 'min-h-[52px] px-5 py-3.5 text-base'
      : size === 'sm'
        ? 'min-h-[40px] px-3 py-2 text-xs'
        : 'min-h-[48px] px-4 py-3 text-sm'

  const weightCls = variant === 'secondary' || variant === 'tertiary' ? 'font-semibold' : 'font-bold'

  let variantCls = ''
  switch (variant) {
    case 'primary':
      variantCls = `rounded-2xl border border-transparent bg-gradient-to-r from-accent to-accent-end text-on-accent shadow-lg shadow-accent/25 ${MOTION_TRANSITION_INTERACTIVE} active:scale-[0.99] disabled:from-card-alt disabled:to-card-alt disabled:text-muted-strong disabled:shadow-none disabled:border disabled:border-border-strong disabled:active:scale-100 disabled:opacity-100 ${focusRing}`
      break
    case 'secondary':
      variantCls = `rounded-2xl border border-border-strong bg-card-alt text-muted hover:text-text hover:border-accent/30 transition-colors ${motionColors} disabled:opacity-45 ${focusRing}`
      break
    case 'tertiary':
      variantCls = `rounded-xl border border-transparent bg-transparent text-muted-mid hover:text-text transition-colors ${motionColors} disabled:opacity-45 disabled:pointer-events-none ${focusRing}`
      break
    case 'muted':
      variantCls = `rounded-2xl border border-border-strong bg-card-alt text-muted-strong shadow-none transition-colors ${motionColors} ${focusRing}`
      break
    case 'danger':
      variantCls = `rounded-xl border border-transparent bg-[#FF5555] text-white transition-[opacity,colors] ${motionColors} hover:opacity-95 active:opacity-90 disabled:opacity-50 ${focusRing}`
      break
    case 'success':
      variantCls = `rounded-xl border border-transparent bg-success text-on-success transition-[opacity,colors] ${motionColors} hover:opacity-95 active:opacity-90 disabled:opacity-50 ${focusRing}`
      break
    case 'successOutline':
      variantCls = `rounded-xl border-2 border-success bg-success/5 text-success transition-colors ${motionColors} hover:bg-success/10 disabled:opacity-45 ${focusRing}`
      break
    default:
      variantCls = ''
  }

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      data-action-button
      className={`inline-flex items-center justify-center gap-2 ${widthCls} ${sizeCls} ${weightCls} ${variantCls} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  )
})

export default ActionButton
