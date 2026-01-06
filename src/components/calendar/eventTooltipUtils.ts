const TOOLTIP_ID_PREFIX = 'event-tooltip'

const sanitizeId = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '')

export const getEventTooltipId = (eventId: string) => {
  const sanitized = sanitizeId(eventId)
  return sanitized ? `${TOOLTIP_ID_PREFIX}-${sanitized}` : TOOLTIP_ID_PREFIX
}
