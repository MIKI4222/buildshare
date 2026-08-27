import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Wallet, Copy, ExternalLink, LogOut, ChevronDown } from 'lucide-react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { useApp } from '../store/app-context';
import { shortAddress } from '../lib/solana/wallet';
import { explorerAddrUrl } from '../providers';

export function WalletButton() {
  const { wallet, connectWallet, disconnectWallet, mode } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!wallet.address) {
    return (
      <Button
        size="sm"
        variant={mode === 'demo' ? 'secondary' : 'primary'}
        loading={wallet.connecting}
        onClick={connectWallet}
        leftIcon={<Wallet className="h-4 w-4" />}
      >
        {wallet.connecting ? 'Connecting...' : 'Connect Wallet'}
      </Button>
    );
  }

  const addr = wallet.address;
  const short = shortAddress(addr);
  const explorer = mode === 'live' ? explorerAddrUrl(addr, 'devnet') : null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 h-8 px-3 rounded-lg border border-ink-300 bg-white text-sm font-medium text-ink-700 hover:bg-ink-50 transition-colors focus-ring"
      >
        <span className="h-2 w-2 rounded-full bg-accent-500" />
        <span className="font-mono">{short}</span>
        <ChevronDown className="h-3.5 w-3.5 text-ink-400" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-white border border-ink-200 rounded-xl shadow-card-hover py-1.5 z-50 animate-scale-in origin-top-right">
          <div className="px-3 py-2 border-b border-ink-100">
            <p className="text-xs text-ink-400">Connected wallet</p>
            <p className="text-sm font-mono text-ink-900 break-all">{addr}</p>
          </div>
          <button
            onClick={() => { navigator.clipboard.writeText(addr); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink-700 hover:bg-ink-50"
          >
            <Copy className="h-4 w-4 text-ink-400" /> Copy address
          </button>
          {explorer && (
            <a href={explorer} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}
               className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink-700 hover:bg-ink-50">
              <ExternalLink className="h-4 w-4 text-ink-400" /> View on Explorer
            </a>
          )}
          <button
            onClick={() => { disconnectWallet(); setOpen(false); navigate('/'); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-error-600 hover:bg-error-50 border-t border-ink-100"
          >
            <LogOut className="h-4 w-4" /> Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
