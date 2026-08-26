import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { CommonModule } from '@angular/common';
import { EventType } from '../../models/event-type.model';
import { EventTypesService } from '../../services/event-types.service';

@Component({
  selector: 'app-event-list',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatProgressSpinnerModule, MatIconModule, MatChipsModule],
  templateUrl: './event-list.html',
  styleUrl: './event-list.scss',
})
export class EventListComponent implements OnInit {
  private eventTypesService = inject(EventTypesService);
  private router = inject(Router);

  eventTypes: EventType[] = [];
  loading = true;
  error = '';

  ngOnInit(): void {
    this.eventTypesService.list().subscribe({
      next: (data) => { this.eventTypes = data; this.loading = false; },
      error: () => { this.error = 'Не удалось загрузить типы событий'; this.loading = false; },
    });
  }

  selectEvent(eventType: EventType): void {
    this.router.navigate(['/slots', eventType.id]);
  }
}
