import type { CalendarListResponse } from '../types/calendar'

export const fixtureCalendarList: CalendarListResponse = {
  items: [
    {
      id: 'primary',
      summary: 'Executive',
      primary: true,
      accessRole: 'owner',
      backgroundColor: '#1A73E8',
      foregroundColor: '#FFFFFF',
    },
    {
      id: 'team@company.com',
      summary: 'Team',
      accessRole: 'writer',
      backgroundColor: '#0B8043',
      foregroundColor: '#FFFFFF',
    },
    {
      id: 'travel@company.com',
      summary: 'Travel',
      accessRole: 'writer',
      backgroundColor: '#F9AB00',
      foregroundColor: '#202124',
    },
    {
      id: 'personal@company.com',
      summary: 'Personal',
      accessRole: 'owner',
      backgroundColor: '#D93025',
      foregroundColor: '#FFFFFF',
    },
    {
      id: 'family@company.com',
      summary: 'Family',
      accessRole: 'reader',
      backgroundColor: '#9334E6',
      foregroundColor: '#FFFFFF',
    },
  ],
}
