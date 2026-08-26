import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/event-list/event-list').then(m => m.EventListComponent) },
  { path: 'slots/:eventTypeId', loadComponent: () => import('./pages/slot-picker/slot-picker').then(m => m.SlotPickerComponent) },
  { path: 'owner', loadComponent: () => import('./pages/owner-dashboard/owner-dashboard').then(m => m.OwnerDashboardComponent) },
  { path: '**', redirectTo: '' },
];
