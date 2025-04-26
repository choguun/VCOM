'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import React from 'react';

function ConnectWallet() {
  return (
    <ConnectButton 
      accountStatus={{
        smallScreen: 'avatar', // Show avatar on small screens
        largeScreen: 'full', // Show full address on large screens
      }}
      chainStatus="icon" // Show only chain icon
      showBalance={{
        smallScreen: false,
        largeScreen: true, // Show balance on large screens
      }}
    />
  );
}

export default ConnectWallet; 