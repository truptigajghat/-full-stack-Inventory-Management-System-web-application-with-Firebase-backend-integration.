import { useEffect, useRef } from 'react';

interface UseUSBScannerProps {
  onScan: (barcode: string) => void;
  // Threshold in milliseconds. Keystrokes faster than this are considered from a scanner.
  timeThreshold?: number;
  // Minimum length of a barcode.
  minLength?: number;
}

export function useUSBScanner({ onScan, timeThreshold = 50, minLength = 3 }: UseUSBScannerProps) {
  const buffer = useRef('');
  const lastKeyTime = useRef<number>(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is actively typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      const currentTime = Date.now();
      
      if (e.key === 'Enter') {
        if (buffer.current.length >= minLength) {
          onScan(buffer.current);
        }
        buffer.current = '';
        return;
      }

      // Ignore single character keys if they are not standard printable characters
      if (e.key.length > 1) {
        return;
      }

      // If time between keystrokes is too long, reset the buffer
      if (currentTime - lastKeyTime.current > timeThreshold) {
        buffer.current = e.key;
      } else {
        buffer.current += e.key;
      }
      
      lastKeyTime.current = currentTime;
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onScan, timeThreshold, minLength]);
}
