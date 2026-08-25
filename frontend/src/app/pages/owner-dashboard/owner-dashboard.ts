import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { forkJoin } from 'rxjs';
import { Booking } from '../../models/booking.model';
import { BookingsService } from '../../services/bookings.service';
import { EventTypesService } from '../../services/event-types.service';
import { BookingStateService } from '../../services/booking-state.service';

@Component({
  selector: 'app-owner-dashboard',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatCardModule, MatButtonModule, MatProgressSpinnerModule,
    MatIconModule, MatFormFieldModule, MatInputModule,
    MatTableModule, MatChipsModule,
  ],
  templateUrl: './owner-dashboard.html',
  styleUrl: './owner-dashboard.scss',
})
export class OwnerDashboardComponent implements OnInit {
  private bookingsService = inject(BookingsService);
  private eventTypesService = inject(EventTypesService);
  private bookingState = inject(BookingStateService);
  private fb = inject(FormBuilder);

  bookings: Booking[] = [];
  loading = false;
  error = '';
  ownerId = '';
  searched = false;

  displayedColumns = ['eventTypeTitle', 'startTime', 'duration', 'guestName', 'guestEmail'];

  form = this.fb.group({
    ownerId: ['', [Validators.required, Validators.minLength(1)]],
  });

  ngOnInit(): void {}

  search(): void {
    if (this.form.invalid) return;
    this.ownerId = this.form.value.ownerId!;
    this.loading = true;
    this.error = '';
    this.searched = true;

    forkJoin({
      apiBookings: this.bookingsService.listUpcoming(this.ownerId),
      eventTypes: this.eventTypesService.list(),
    }).subscribe({
      next: ({ apiBookings, eventTypes }) => {
        const ownerTypeIds = eventTypes
          .filter(e => e.ownerId === this.ownerId)
          .map(e => e.id);
        // Мержим: данные из API + бронирования текущей сессии
        const sessionBookings = this.bookingState.getUpcoming(this.ownerId, ownerTypeIds);
        const allIds = new Set(apiBookings.map(b => b.id));
        const merged = [
          ...apiBookings,
          ...sessionBookings.filter(b => !allIds.has(b.id)),
        ].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
        this.bookings = merged;
        this.loading = false;
      },
      error: () => { this.error = 'Не удалось загрузить бронирования'; this.loading = false; },
    });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
  }
}
