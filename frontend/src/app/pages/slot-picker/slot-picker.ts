import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Slot } from '../../models/slot.model';
import { EventType } from '../../models/event-type.model';
import { SlotsService } from '../../services/slots.service';
import { BookingsService } from '../../services/bookings.service';
import { EventTypesService } from '../../services/event-types.service';
import { Booking } from '../../models/booking.model';
import { BookingStateService } from '../../services/booking-state.service';

@Component({
  selector: 'app-slot-picker',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatCardModule, MatButtonModule, MatProgressSpinnerModule,
    MatIconModule, MatSnackBarModule,
    MatFormFieldModule, MatInputModule,
    MatDatepickerModule, MatNativeDateModule,
  ],
  templateUrl: './slot-picker.html',
  styleUrl: './slot-picker.scss',
})
export class SlotPickerComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private slotsService = inject(SlotsService);
  private bookingsService = inject(BookingsService);
  private eventTypesService = inject(EventTypesService);
  private bookingState = inject(BookingStateService);
  private snackBar = inject(MatSnackBar);
  private fb = inject(FormBuilder);

  eventTypeId = '';
  eventType: EventType | null = null;
  loading = true;
  booking = false;
  error = '';
  confirmedBooking: Booking | null = null;

  selectedDate: Date | null = null;
  selectedSlot: Slot | null = null;

  slotsByDay = new Map<string, Slot[]>();

  today = new Date();
  maxDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  slotsForSelectedDay: Slot[] = [];

  form = this.fb.group({
    guestName: ['', [Validators.required, Validators.minLength(2)]],
    guestEmail: ['', [Validators.required, Validators.email]],
  });

  ngOnInit(): void {
    this.eventTypeId = this.route.snapshot.paramMap.get('eventTypeId') ?? '';

    forkJoin({
      types: this.eventTypesService.list(),
      slots: this.slotsService.listAvailable(this.eventTypeId),
    }).subscribe({
      next: ({ types, slots }) => {
        this.eventType = types.find(t => t.id === this.eventTypeId) ?? null;
        const expandedSlots = this.expandSlots(slots, this.eventType?.durationMinutes ?? 0);
        this.buildSlotsByDay(expandedSlots);
        this.loading = false;
      },
      error: () => { this.error = 'Не удалось загрузить данные'; this.loading = false; },
    });
  }

  /**
   * Универсальная нарезка: из каждого физического слота генерируем
   * Math.floor(slot.durationMinutes / eventDuration) под-слотов,
   * каждый сдвинут на i * eventDuration минут от начала.
   * Слоты, которые короче eventDuration, отбрасываются.
   */
  private expandSlots(slots: Slot[], eventDuration: number): Slot[] {
    if (eventDuration <= 0) return slots;
    const result: Slot[] = [];

    for (const slot of slots) {
      const count = Math.floor(slot.durationMinutes / eventDuration);
      for (let i = 0; i < count; i++) {
        const offsetMs = i * eventDuration * 60 * 1000;
        const startTime = new Date(new Date(slot.startTime).getTime() + offsetMs).toISOString();
        result.push({
          ...slot,
          id: count === 1 ? slot.id : `${slot.id}-${i}`,
          startTime,
          durationMinutes: eventDuration,
        });
      }
    }
    return result;
  }

  private removeBookedSlotFromMap(slotId: string): void {
    for (const [key, slots] of this.slotsByDay.entries()) {
      const filtered = slots.filter(s => s.id !== slotId);
      if (filtered.length !== slots.length) {
        if (filtered.length === 0) {
          this.slotsByDay.delete(key);
        } else {
          this.slotsByDay.set(key, filtered);
        }
        break;
      }
    }
    if (this.selectedDate) {
      this.slotsForSelectedDay = this.slotsByDay.get(
        this.toDateKey(this.selectedDate)
      ) ?? [];
    }
  }

  private buildSlotsByDay(slots: Slot[]): void {
    this.slotsByDay.clear();
    for (const slot of slots) {
      const key = this.toDateKey(new Date(slot.startTime));
      const arr = this.slotsByDay.get(key) ?? [];
      arr.push(slot);
      this.slotsByDay.set(key, arr);
    }
  }

  private toDateKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  dateFilter = (date: Date | null): boolean => {
    if (!date) return false;
    return this.slotsByDay.has(this.toDateKey(date));
  };

  dateClass = (date: Date): string => {
    return this.slotsByDay.has(this.toDateKey(date)) ? 'has-slots' : '';
  };

  onDateSelected(date: Date | null): void {
    this.selectedDate = date;
    this.selectedSlot = null;
    this.confirmedBooking = null;
    this.slotsForSelectedDay = date
      ? (this.slotsByDay.get(this.toDateKey(date)) ?? [])
      : [];
  }

  selectSlot(slot: Slot): void {
    this.selectedSlot = slot;
    this.confirmedBooking = null;
  }

  formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  formatDate(iso: string): string {
    const date = new Date(iso);
    const dayAndMonth = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    return `${dayAndMonth} ${date.getFullYear()} года`;
  }

  formatDateLabel(date: Date): string {
    return date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  submitBooking(): void {
    if (this.form.invalid || !this.selectedSlot) return;
    this.booking = true;
    const { guestName, guestEmail } = this.form.value;
    this.bookingsService.create({
      slotId: this.selectedSlot.id,
      guestName: guestName!,
      guestEmail: guestEmail!,
    }).subscribe({
      next: (b) => {
        // Prism возвращает статичный пример — подставляем реальные данные пользователя
        const actual: typeof b = {
          ...b,
          eventTypeId: this.eventTypeId,
          eventTypeTitle: this.eventType?.title ?? b.eventTypeTitle,
          guestName: guestName!,
          guestEmail: guestEmail!,
          slotId: this.selectedSlot!.id,
          startTime: this.selectedSlot!.startTime,
          durationMinutes: this.selectedSlot!.durationMinutes,
        };
        this.confirmedBooking = actual;
        this.bookingState.add(actual);
        this.booking = false;
        this.removeBookedSlotFromMap(actual.slotId);
        this.selectedSlot = null;
        this.snackBar.open('Бронирование успешно создано!', 'OK', { duration: 4000 });
      },
      error: () => {
        this.booking = false;
        this.snackBar.open('Ошибка при бронировании. Попробуйте другой слот.', 'OK', { duration: 4000 });
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/']);
  }
}