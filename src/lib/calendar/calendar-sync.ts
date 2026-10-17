/**
 * Calendar Sync & Export Utilities
 * Provides standard 1-click Google Calendar URL generation and RFC 5545 iCalendar (.ics) export
 * compatible with Apple Calendar (iOS/macOS), Google Calendar, and Microsoft Outlook.
 */

export interface CalendarEventPayload {
  title: string
  description?: string
  location?: string
  startTime: string | Date
  endTime?: string | Date
  url?: string
}

function formatDateToUtcIsoBasic(dateInput: string | Date): string {
  const d = new Date(dateInput)
  if (isNaN(d.getTime())) return ''
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

/**
 * Generates a 1-click Google Calendar web event creation URL.
 */
export function generateGoogleCalendarUrl(event: CalendarEventPayload): string {
  const start = new Date(event.startTime)
  let end = event.endTime ? new Date(event.endTime) : new Date(start.getTime() + 60 * 60 * 1000)
  if (isNaN(end.getTime()) || end <= start) {
    end = new Date(start.getTime() + 60 * 60 * 1000)
  }

  const startIso = formatDateToUtcIsoBasic(start)
  const endIso = formatDateToUtcIsoBasic(end)

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${startIso}/${endIso}`,
  })

  if (event.description) {
    params.set('details', event.description)
  }

  if (event.location) {
    params.set('location', event.location)
  }

  if (event.url) {
    params.set('sprop', `website:${event.url}`)
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/**
 * Generates an RFC 5545 iCalendar (.ics) string compatible with Apple Calendar, Outlook, and mobile devices.
 */
export function generateIcsContent(event: CalendarEventPayload): string {
  const start = new Date(event.startTime)
  let end = event.endTime ? new Date(event.endTime) : new Date(start.getTime() + 60 * 60 * 1000)
  if (isNaN(end.getTime()) || end <= start) {
    end = new Date(start.getTime() + 60 * 60 * 1000)
  }

  const dtStamp = formatDateToUtcIsoBasic(new Date())
  const dtStart = formatDateToUtcIsoBasic(start)
  const dtEnd = formatDateToUtcIsoBasic(end)
  const uid = `captodesk-${Date.now()}-${Math.random().toString(36).substring(2, 9)}@captodesk.com`

  const cleanText = (str?: string) =>
    (str || '')
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n')

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CaptoDesk//Appointment Engine//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${cleanText(event.title)}`,
    event.description ? `DESCRIPTION:${cleanText(event.description)}` : '',
    event.location ? `LOCATION:${cleanText(event.location)}` : '',
    event.url ? `URL:${event.url}` : '',
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n')
}

/**
 * Triggers a browser download of an .ics file for Apple Calendar / Outlook.
 */
export function downloadIcsFile(event: CalendarEventPayload, filename = 'appointment.ics') {
  if (typeof window === 'undefined') return
  const icsData = generateIcsContent(event)
  const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' })
  const link = document.createElement('a')
  link.href = window.URL.createObjectURL(blob)
  link.setAttribute('download', filename.endsWith('.ics') ? filename : `${filename}.ics`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
