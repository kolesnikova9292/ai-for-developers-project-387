import { expect, Page, test } from '@playwright/test';

type EventTypeFixture = {
  id: string;
  title: string;
  durationMinutes: number;
};

const eventTypes: EventTypeFixture[] = [
  { id: 'et-001', title: 'Консультация', durationMinutes: 30 },
  { id: 'et-002', title: 'Стратегическая сессия', durationMinutes: 60 },
  { id: 'et-003', title: 'Быстрый созвон', durationMinutes: 15 },
];

async function mockBookingApi(page: Page): Promise<void> {
  let createdCounter = 0;

  await page.route('**/api/event-types', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        eventTypes.map((e) => ({
          id: e.id,
          ownerId: 'owner-yulia-001',
          title: e.title,
          description: `${e.title} для проверки e2e`,
          durationMinutes: e.durationMinutes,
        })),
      ),
    });
  });

  await page.route('**/api/event-types/*/slots', async (route) => {
    const eventTypeId = route.request().url().split('/event-types/')[1]?.split('/slots')[0] ?? 'et-001';
    const day = new Date(Date.now() + 24 * 60 * 60 * 1000);
    day.setUTCHours(10, 0, 0, 0);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: `slot-${eventTypeId}-001`,
          eventTypeId,
          startTime: day.toISOString(),
          durationMinutes: 120,
          isBooked: false,
        },
      ]),
    });
  });

  await page.route('**/api/bookings', async (route) => {
    createdCounter += 1;
    const requestBody = route.request().postDataJSON() as { slotId: string; guestName: string; guestEmail: string };

    // Специально возвращаем "Консультация", чтобы проверить, что UI перезаписывает тип выбранным событием.
    const bookingResponse = {
      id: `booking-pw-${createdCounter}`,
      eventTypeId: 'et-001',
      eventTypeTitle: 'Консультация',
      slotId: requestBody.slotId,
      startTime: '2026-08-11T10:00:00Z',
      durationMinutes: 30,
      guestName: requestBody.guestName,
      guestEmail: requestBody.guestEmail,
    };

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(bookingResponse),
    });
  });

  await page.route('**/api/owners/*/bookings/upcoming', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'booking-api-001',
          eventTypeId: 'et-002',
          eventTypeTitle: 'Стратегическая сессия',
          slotId: 'slot-api-010',
          startTime: '2026-08-13T10:00:00Z',
          durationMinutes: 60,
          guestName: 'Иван Петров',
          guestEmail: 'ivan.petrov@example.com',
        },
      ]),
    });
  });
}

async function createBooking(page: Page, eventTypeTitle: string, guestName: string, guestEmail: string): Promise<void> {
  const card = page.locator('.event-card').filter({ hasText: eventTypeTitle });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Выбрать слот' }).click();

  await expect(page.getByRole('heading', { name: new RegExp(eventTypeTitle) })).toBeVisible();
  await page.locator('.mat-calendar-body-cell.has-slots .mat-calendar-body-cell-content').first().click();
  await page.locator('.time-buttons button').first().click();

  await page.getByPlaceholder('Ваше имя').fill(guestName);
  await page.getByPlaceholder('your@email.com').fill(guestEmail);
  await page.getByRole('button', { name: 'Забронировать' }).click();
}

for (const eventType of eventTypes) {
  test(`booking confirmation keeps "${eventType.title}" session type`, async ({ page }) => {
    await mockBookingApi(page);
    await page.goto('/');

    const guestName = `PW ${eventType.id}`;
    const guestEmail = `${eventType.id}@example.com`;
    await createBooking(page, eventType.title, guestName, guestEmail);

    const confirmed = page.locator('.confirmed-card');
    await expect(confirmed).toContainText(eventType.title);
    await expect(confirmed).toContainText(guestName);
    await expect(confirmed).toContainText(guestEmail);
  });
}

test('owner call list shows all booked calls with correct session types', async ({ page }) => {
  await mockBookingApi(page);
  await page.goto('/');

  const createdGuests = [
    { title: 'Консультация', name: 'Guest Consultation', email: 'consultation@example.com' },
    { title: 'Стратегическая сессия', name: 'Guest Strategy', email: 'strategy@example.com' },
    { title: 'Быстрый созвон', name: 'Guest Quick', email: 'quick@example.com' },
  ];

  for (const guest of createdGuests) {
    await createBooking(page, guest.title, guest.name, guest.email);
    await page.getByRole('link', { name: /События/ }).click();
  }

  await page.getByRole('link', { name: /Владелец/ }).click();
  await page.getByPlaceholder('Введите ID владельца').fill('owner-yulia-001');
  await page.getByRole('button', { name: 'Поиск' }).click();

  await expect(page.getByText(/Результаты \(4\)/)).toBeVisible();
  await expect(page.locator('table')).toContainText('Иван Петров');

  for (const guest of createdGuests) {
    const row = page.locator('tr', { hasText: guest.name });
    await expect(row).toContainText(guest.title);
    await expect(row).toContainText(guest.email);
  }
});
