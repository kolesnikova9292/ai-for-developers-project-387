export interface Booking {
  id: string;
  eventTypeId: string;
  eventTypeTitle: string;
  slotId: string;
  startTime: string;
  durationMinutes: number;
  guestName: string;
  guestEmail: string;
}

export interface CreateBookingRequest {
  slotId: string;
  guestName: string;
  guestEmail: string;
}
