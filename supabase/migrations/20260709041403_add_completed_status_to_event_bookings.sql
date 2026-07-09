alter table event_bookings
  drop constraint event_bookings_status_check;

alter table event_bookings
  add constraint event_bookings_status_check
  check (status in ('pending', 'confirmed', 'cancelled', 'completed'));
