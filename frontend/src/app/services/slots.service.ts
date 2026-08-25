import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Slot } from '../models/slot.model';

@Injectable({ providedIn: 'root' })
export class SlotsService {
  private http = inject(HttpClient);

  listAvailable(eventTypeId: string): Observable<Slot[]> {
    return this.http.get<Slot[]>(`/api/event-types/${eventTypeId}/slots`);
  }
}
