import { render, screen } from '@testing-library/react'
import { Button, TouchTarget } from './button'

test('renders a button by default', () => {
  render(<Button>Click me</Button>)

  expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
})

test('renders a link when href is provided', () => {
  render(<Button href="https://example.com">Docs</Button>)

  expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute('href', 'https://example.com')
})

test('renders outline and plain variants', () => {
  render(
    <>
      <Button outline>Outline</Button>
      <Button plain>Plain</Button>
    </>
  )

  expect(screen.getByRole('button', { name: 'Outline' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Plain' })).toBeInTheDocument()
})

test('touch target renders a hidden hit area', () => {
  const { container } = render(<TouchTarget>Hit area</TouchTarget>)

  expect(container.querySelector('span[aria-hidden="true"]')).toBeInTheDocument()
})
