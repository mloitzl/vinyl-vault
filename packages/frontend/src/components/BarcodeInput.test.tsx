import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BarcodeInput } from './BarcodeInput';

describe('BarcodeInput', () => {
  it('renders the input field with label', () => {
    render(
      <BarcodeInput
        value=""
        onValueChange={() => {}}
        onSubmit={() => {}}
        isLoading={false}
        isScanning={false}
        onStartCamera={() => {}}
        onStopCamera={() => {}}
      />
    );

    // Check for the input with placeholder
    expect(screen.getByPlaceholderText(/enter or scan barcode/i)).toBeInTheDocument();
  });

  it('updates input value on change', () => {
    const onValueChange = vi.fn();
    render(
      <BarcodeInput
        value=""
        onValueChange={onValueChange}
        onSubmit={() => {}}
        isLoading={false}
        isScanning={false}
        onStartCamera={() => {}}
        onStopCamera={() => {}}
      />
    );

    const input = screen.getByPlaceholderText(/enter or scan barcode/i);
    fireEvent.change(input, { target: { value: '1234567890' } });

    expect(onValueChange).toHaveBeenCalledWith('1234567890');
  });

  it('calls onSubmit when form is submitted', () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <BarcodeInput
        value="1234567890"
        onValueChange={() => {}}
        onSubmit={onSubmit}
        isLoading={false}
        isScanning={false}
        onStartCamera={() => {}}
        onStopCamera={() => {}}
      />
    );

    const form = container.querySelector('form');
    if (form) fireEvent.submit(form);

    expect(onSubmit).toHaveBeenCalled();
  });

  it('calls onStartCamera when camera button is clicked in normal state', () => {
    const onStartCamera = vi.fn();
    render(
      <BarcodeInput
        value=""
        onValueChange={() => {}}
        onSubmit={() => {}}
        isLoading={false}
        isScanning={false}
        onStartCamera={onStartCamera}
        onStopCamera={() => {}}
      />
    );

    const cameraButton = screen.getByText(/use camera/i);
    fireEvent.click(cameraButton);

    expect(onStartCamera).toHaveBeenCalled();
  });

  it('calls onStopCamera when camera button is clicked in scanning state', () => {
    const onStopCamera = vi.fn();
    render(
      <BarcodeInput
        value=""
        onValueChange={() => {}}
        onSubmit={() => {}}
        isLoading={false}
        isScanning={true}
        onStartCamera={() => {}}
        onStopCamera={onStopCamera}
      />
    );

    const cameraButton = screen.getByText(/stop camera/i);
    fireEvent.click(cameraButton);

    expect(onStopCamera).toHaveBeenCalled();
  });

  it('disables lookup button when loading', () => {
    render(
      <BarcodeInput
        value="1234567890"
        onValueChange={() => {}}
        onSubmit={() => {}}
        isLoading={true}
        isScanning={false}
        onStartCamera={() => {}}
        onStopCamera={() => {}}
      />
    );

    // The button should show "Searching..." text and be disabled
    const buttons = screen.getAllByRole('button');
    const lookupButton = buttons.find((btn) => btn.textContent?.includes('Searching'));
    expect(lookupButton).toBeDisabled();
  });

  it('shows correct button text based on isScanning prop', () => {
    const { rerender } = render(
      <BarcodeInput
        value=""
        onValueChange={() => {}}
        onSubmit={() => {}}
        isLoading={false}
        isScanning={false}
        onStartCamera={() => {}}
        onStopCamera={() => {}}
      />
    );

    expect(screen.getByText(/use camera/i)).toBeInTheDocument();

    rerender(
      <BarcodeInput
        value=""
        onValueChange={() => {}}
        onSubmit={() => {}}
        isLoading={false}
        isScanning={true}
        onStartCamera={() => {}}
        onStopCamera={() => {}}
      />
    );

    expect(screen.getByText(/stop camera/i)).toBeInTheDocument();
  });
});
