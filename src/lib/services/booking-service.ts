import type { SupabaseClient } from '@supabase/supabase-js'
import {
  calculateAvailableSlots,
  localDateTimeToUtc,
  formatSlotDisplayTime,
  formatSlotDisplayDate,
  formatSlotDisplayDateTime,
  type AvailableSlot,
  type CalculateSlotsParams
} from '../booking/availability.ts'
import {
  createBooking,
  customerCancelBooking,
  customerRescheduleBooking,
  ownerUpdateBookingStatus,
  type CreateBookingInput,
  type BookingResult
} from '../booking/booking-manager.ts'

/**
 * BookingService
 * 
 * Domain service managing organization timezone availability, public booking
 * slot calculation, and customer self-service scheduling workflows.
 */
export class BookingService {
  /**
   * Computes available booking slots for a business day adhering to canonical org timezone.
   */
  static calculateSlots(params: CalculateSlotsParams): AvailableSlot[] {
    return calculateAvailableSlots(params)
  }

  /**
   * Alias for calculateSlots.
   */
  static getAvailableSlots(params: CalculateSlotsParams): AvailableSlot[] {
    return this.calculateSlots(params)
  }

  /**
   * Converts local business datetime to UTC ISO string.
   */
  static localToUtc(localDate: string, localTime: string, timezone: string): string {
    return localDateTimeToUtc(localDate, localTime, timezone).toISOString()
  }

  /**
   * Formats a slot timestamp to localized time display string in org timezone.
   */
  static formatTime(isoStringOrDate: string | Date, timezone: string): string {
    const d = typeof isoStringOrDate === 'string' ? new Date(isoStringOrDate) : isoStringOrDate
    return formatSlotDisplayTime(d, timezone)
  }

  /**
   * Formats a slot timestamp to localized date display string in org timezone.
   */
  static formatDate(isoStringOrDate: string | Date, timezone: string): string {
    const d = typeof isoStringOrDate === 'string' ? new Date(isoStringOrDate) : isoStringOrDate
    return formatSlotDisplayDate(d, timezone)
  }

  /**
   * Formats full datetime string in org timezone.
   */
  static formatDateTime(isoStringOrDate: string | Date, timezone: string): string {
    const d = typeof isoStringOrDate === 'string' ? new Date(isoStringOrDate) : isoStringOrDate
    return formatSlotDisplayDateTime(d, timezone)
  }

  /**
   * Creates an appointment booking for a customer.
   */
  static async createAppointment(
    supabase: SupabaseClient,
    input: CreateBookingInput
  ): Promise<BookingResult> {
    return createBooking(supabase, input)
  }

  /**
   * Alias for createAppointment.
   */
  static async bookAppointment(
    supabase: SupabaseClient,
    input: CreateBookingInput
  ): Promise<BookingResult> {
    return this.createAppointment(supabase, input)
  }

  /**
   * Cancels a scheduled appointment by token or id.
   */
  static async cancelAppointment(
    supabase: SupabaseClient,
    tokenOrId: string,
    reason?: string
  ) {
    return customerCancelBooking(supabase, tokenOrId, reason)
  }

  /**
   * Reschedules an existing appointment to a new time.
   */
  static async rescheduleAppointment(
    supabase: SupabaseClient,
    manageToken: string,
    newStartTime: string
  ) {
    return customerRescheduleBooking(supabase, manageToken, newStartTime)
  }

  /**
   * Updates booking status by owner/technician.
   */
  static async updateStatus(
    supabase: SupabaseClient,
    appointmentId: string,
    orgId: string,
    newStatus: 'confirmed' | 'cancelled' | 'completed' | 'no_show',
    reason?: string
  ) {
    return ownerUpdateBookingStatus(supabase, { appointmentId, orgId, newStatus, reason })
  }
}
