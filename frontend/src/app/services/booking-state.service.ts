import { Injectable } from '@angular/core';
import { Booking } from '../models/booking.model';

@Injectable({ providedIn: 'root' })
export class BookingStateService {
  private bookings: Booking[] = [];

  add(booking: Booking): void {
    this.bookings.push(booking);
  }

  getUpcoming(ownerId: string, ownerEventTypeIds: string[]): Booking[] {
    const now = new Date();
    return this.bookings.filter(
      b => ownerEventTypeIds.includes(b.eventTypeId) && new Date(b.startTime) >= now
    );
  }
}
