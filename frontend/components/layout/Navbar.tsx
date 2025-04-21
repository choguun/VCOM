import React from 'react';
import Link from 'next/link';
// import { Button } from '@/components/ui/button'; // No longer needed directly
import ConnectWallet from './ConnectWallet'; // Import the new component

const Navbar = () => {
  return (
    <nav className="border-b bg-background">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        <Link href="/" className="font-bold text-lg">
          VCOM
        </Link>
        <div className="flex items-center space-x-4">
          <Link href="/marketplace" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
            Marketplace
          </Link>
          <Link href="/my-assets" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
            My Assets
          </Link>
          <Link href="/actions" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
            Actions
          </Link>
          {/* Replace placeholder with actual component */}
          <ConnectWallet />
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 