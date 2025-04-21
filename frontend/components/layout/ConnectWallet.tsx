'use client';

import React from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { injected } from 'wagmi/connectors' // Import specific connectors if needed

function ConnectWallet() {
  const { address, isConnected, connector } = useAccount();
  const { connect, connectors, error, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  const shortenAddress = (addr: string) => {
    if (!addr) return "";
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  if (isConnected) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
                {shortenAddress(address || '')}
                {connector && <span className="ml-2 text-xs text-muted-foreground">({connector.name})</span>}
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {/* Add links to My Assets or other relevant pages here */}
          {/* <DropdownMenuItem asChild><Link href="/my-assets">My Assets</Link></DropdownMenuItem> */}
          <DropdownMenuItem onClick={() => disconnect()}> 
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isPending}>
          {isPending ? 'Connecting...' : 'Connect Wallet'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Connect with</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {connectors
            .filter(c => c.id !== 'safe' && c.id !== 'injected') // Filter out generic/duplicate connectors initially
            .map((connector) => (
          <DropdownMenuItem key={connector.id} onClick={() => connect({ connector })} disabled={isPending}>
            {connector.name}
            {isPending && connector.id === connect.arguments?.[0]?.connector?.id && ' (connecting)'}
          </DropdownMenuItem>
        ))}
        {/* Provide specific button for injected/MetaMask if available */} 
        {connectors.find(c => c.id === 'injected') && (
             <DropdownMenuItem key={'injected'} onClick={() => connect({ connector: injected() })} disabled={isPending}>
                Browser Wallet
                {isPending && connect.arguments?.[0]?.connector?.id === 'injected' && ' (connecting)'}
            </DropdownMenuItem>
        )}
        {error && <DropdownMenuItem disabled className="text-red-500 text-xs">{error.message}</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>

  );
}

export default ConnectWallet; 