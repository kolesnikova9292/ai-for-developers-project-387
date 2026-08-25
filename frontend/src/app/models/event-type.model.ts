export interface Owner {
  id: string;
  name: string;
  email: string;
}

export interface EventType {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  durationMinutes: number;
}

export interface CreateEventTypeRequest {
  ownerId: string;
  title: string;
  description: string;
  durationMinutes: number;
}
