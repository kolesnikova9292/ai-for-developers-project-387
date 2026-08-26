import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { EventType, CreateEventTypeRequest } from '../models/event-type.model';

@Injectable({ providedIn: 'root' })
export class EventTypesService {
  private http = inject(HttpClient);
  private baseUrl = '/api/event-types';

  list(): Observable<EventType[]> {
    return this.http.get<EventType[]>(this.baseUrl);
  }

  create(body: CreateEventTypeRequest): Observable<EventType> {
    return this.http.post<EventType>(this.baseUrl, body);
  }
}
