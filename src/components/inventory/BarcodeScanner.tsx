import React, { useState } from 'react';
import { X, Scan, Keyboard } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface BarcodeScannerProps {
  onClose: () => void;
  onScan: (barcode: string) => void;
}

export function BarcodeScanner({ onClose, onScan }: BarcodeScannerProps) {
  const [manualCode, setManualCode] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScan(manualCode.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-background border border-border shadow-2xl rounded-3xl overflow-hidden p-8 animate-in zoom-in-95 duration-300">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="space-y-6 pt-2">
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="p-4 bg-primary/10 rounded-2xl">
              <Scan className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-serif">Quick Scan</h2>
            <p className="text-sm text-muted-foreground">
              Scan a product barcode with your hardware scanner or enter it manually below.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-1">
                <Keyboard className="h-3 w-3" />
                Manual Entry
              </div>
              <Input 
                autoFocus
                placeholder="Enter barcode or SKU..."
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="h-14 text-lg font-mono tracking-widest text-center rounded-2xl border-2 focus-visible:ring-primary focus-visible:border-primary"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-14 rounded-2xl text-xs font-bold uppercase tracking-[0.2em]"
              disabled={!manualCode.trim()}
            >
              Confirm Scan
            </Button>
          </form>

          <div className="pt-4 text-center">
            <p className="text-[10px] text-muted-foreground/40 font-bold uppercase tracking-widest leading-relaxed">
              Hardware Scanner is always active<br />
              Just scan anywhere on the page
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
