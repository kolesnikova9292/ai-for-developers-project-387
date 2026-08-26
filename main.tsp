import "@typespec/http";

using TypeSpec.Http;

@service(#{
  title: "Event Types API",
})
namespace EventTypesAPI;

model Owner {
  id: string;
  name: string;
  email: string;
}

model EventType {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  durationMinutes: int32;
}

model CreateEventTypeRequest {
  ownerId: string;
  title: string;
  description: string;
  durationMinutes: int32;
}

model Slot {
  id: string;
  eventTypeId: string;
  startTime: utcDateTime;
  durationMinutes: int32;
  isBooked: boolean;
}

model Booking {
  id: string;
  eventTypeId: string;
  eventTypeTitle: string;
  slotId: string;
  startTime: utcDateTime;
  durationMinutes: int32;
  guestName: string;
  guestEmail: string;
}

model CreateBookingRequest {
  slotId: string;
  guestName: string;
  guestEmail: string;
}

@route("/event-types")
interface EventTypes {
  @get list(): EventType[];
  @post create(@body body: CreateEventTypeRequest): EventType;
}

model ConflictError {
  @statusCode _: 409;
  message: string;
}

model SlotUnavailableError {
  @statusCode _: 422;
  message: string;
}

@route("/event-types/{eventTypeId}/slots")
@doc("Returns available (not booked) slots for the next 14 days starting from today.")
interface EventTypeSlots {
  @get listAvailable(@path eventTypeId: string): Slot[];
}

@route("/bookings")
interface GuestBookings {
  @post create(@body body: CreateBookingRequest): Booking | ConflictError | SlotUnavailableError;
}

@route("/owners/{ownerId}/bookings/upcoming")
interface OwnerBookings {
  @get list(@path ownerId: string): Booking[];
}
