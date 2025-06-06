// frontend/src/components/ui/Button.test.tsx
import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/button'; 
import { describe, it, expect } from 'vitest';

describe('Button component', () => {
  it('renders correctly', () => {
    render(<Button>Click Me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });
});
