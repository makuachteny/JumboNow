import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import MyTicketsScreen from '../MyTicketsScreen';

// Mock tickets data
const futureDate = new Date(Date.now() + 86400000 * 7).toISOString(); // 7 days ahead
const pastDate = new Date(Date.now() - 86400000 * 7).toISOString(); // 7 days ago

const mockUpcomingTickets = [
  {
    id: 'ticket-1',
    status: 'confirmed',
    confirmation_code: 'ABC12345',
    price_paid: 0,
    event: {
      id: 'event-1',
      title: 'Jazz Night',
      location: 'Hotung Café',
      start_time: futureDate,
      end_time: futureDate,
      organizer_name: 'Music Club',
    },
  },
  {
    id: 'ticket-2',
    status: 'confirmed',
    confirmation_code: 'DEF67890',
    price_paid: 10,
    event: {
      id: 'event-2',
      title: 'Hackathon',
      location: 'SEC',
      start_time: futureDate,
      end_time: futureDate,
      organizer_name: 'CS Society',
    },
  },
];

const mockPastTicket = {
  id: 'ticket-3',
  status: 'confirmed',
  confirmation_code: 'GHI11111',
  price_paid: 0,
  event: {
    id: 'event-3',
    title: 'Old Event',
    location: 'Campus Center',
    start_time: pastDate,
    end_time: pastDate,
    organizer_name: 'Student Org',
  },
};

const mockCancelledTicket = {
  id: 'ticket-4',
  status: 'cancelled',
  confirmation_code: 'JKL22222',
  price_paid: 0,
  event: {
    id: 'event-4',
    title: 'Cancelled Event',
    location: 'Somewhere',
    start_time: futureDate,
    end_time: futureDate,
    organizer_name: 'Org',
  },
};

const allTickets = [...mockUpcomingTickets, mockPastTicket, mockCancelledTicket];

// Mock the tickets service
jest.mock('../../services/tickets.service', () => ({
  ticketsService: {
    getMyTickets: jest.fn(),
    cancelReservation: jest.fn(),
    submitRating: jest.fn(),
    getSession: jest.fn(),
    getWalletPassUrl: jest.fn((id) => `https://test.supabase.co/functions/v1/wallet-pass?reservation_id=${id}`),
    subscribeToReservations: jest.fn(() => ({ unsubscribe: jest.fn() })),
  },
}));

const { ticketsService } = require('../../services/tickets.service');

const mockNavigation = {
  navigate: jest.fn(),
};

describe('MyTicketsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ticketsService.getMyTickets.mockResolvedValue(allTickets);
  });

  describe('Ticket count badge', () => {
    it('shows upcoming ticket count in header badge', async () => {
      const { getByText } = render(
        <MyTicketsScreen navigation={mockNavigation} />
      );

      await waitFor(() => {
        // 2 upcoming confirmed tickets (mockUpcomingTickets), cancelled one is excluded
        expect(getByText('2')).toBeTruthy();
      });
    });

    it('shows "My Tickets" header title', async () => {
      const { getByText } = render(
        <MyTicketsScreen navigation={mockNavigation} />
      );

      await waitFor(() => {
        expect(getByText('My Tickets')).toBeTruthy();
      });
    });

    it('does not show badge when no upcoming tickets', async () => {
      ticketsService.getMyTickets.mockResolvedValue([mockPastTicket]);

      const { queryByText, getByText } = render(
        <MyTicketsScreen navigation={mockNavigation} />
      );

      await waitFor(() => {
        expect(getByText('My Tickets')).toBeTruthy();
      });

      // The badge with count "0" should not exist
      // (badge only renders when upcomingTickets.length > 0)
      expect(queryByText('0')).toBeNull();
    });
  });

  describe('Apple Wallet button', () => {
    it('shows wallet button on iOS for upcoming confirmed tickets', async () => {
      Platform.OS = 'ios';

      const { getAllByText } = render(
        <MyTicketsScreen navigation={mockNavigation} />
      );

      await waitFor(() => {
        const walletButtons = getAllByText('Add to Apple Wallet');
        // Should show wallet button for 2 upcoming confirmed tickets
        expect(walletButtons.length).toBe(2);
      });
    });

    it('does NOT show wallet button on Android', async () => {
      Platform.OS = 'android';

      const { queryByText, getByText } = render(
        <MyTicketsScreen navigation={mockNavigation} />
      );

      await waitFor(() => {
        expect(getByText('My Tickets')).toBeTruthy();
      });

      // Wait for tickets to load, then verify no wallet button
      await waitFor(() => {
        expect(queryByText('Add to Apple Wallet')).toBeNull();
      });
    });

    it('does NOT show wallet button for cancelled tickets', async () => {
      Platform.OS = 'ios';
      ticketsService.getMyTickets.mockResolvedValue([mockCancelledTicket]);

      const { queryByText, getByText } = render(
        <MyTicketsScreen navigation={mockNavigation} />
      );

      await waitFor(() => {
        expect(getByText('My Tickets')).toBeTruthy();
      });

      expect(queryByText('Add to Apple Wallet')).toBeNull();
    });

    it('does NOT show wallet button for past tickets', async () => {
      Platform.OS = 'ios';
      ticketsService.getMyTickets.mockResolvedValue([mockPastTicket]);

      const { queryByText, getByText } = render(
        <MyTicketsScreen navigation={mockNavigation} />
      );

      await waitFor(() => {
        expect(getByText('My Tickets')).toBeTruthy();
      });

      expect(queryByText('Add to Apple Wallet')).toBeNull();
    });
  });
});
