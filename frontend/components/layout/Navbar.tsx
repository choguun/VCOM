import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button'; // Assuming default shadcn setup

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
          {/* Placeholder for Wallet Connect Button */}
          <Button variant="outline" size="sm">
            Connect Wallet
          </Button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 