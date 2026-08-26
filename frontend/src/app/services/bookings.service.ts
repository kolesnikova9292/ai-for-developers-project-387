import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Booking, CreateBookingRequest } from '../models/booking.model';

@Injectable({ providedIn: 'root' })
export class BookingsService {
  private http = inject(HttpClient);

  create(body: CreateBookingRequest): Observable<Booking> {
    return this.http.post<Booking>('/api/bookings', body);
  }

  listUpcoming(ownerId: string): Observable<Booking[]> {
    return this.http.get<Booking[]>(`/api/owners/${ownerId}/bookings/upcoming`);
  }
}
