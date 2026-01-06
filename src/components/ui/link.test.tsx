import { render, screen } from '@testing-library/react'
import { Link } from './link'

test('renders an anchor with href', () => {
  render(<Link href="/account">Account</Link>)

  expect(screen.getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/account')
})
