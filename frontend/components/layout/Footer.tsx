import React from 'react';

const Footer = () => {
  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Verifiable Carbon Offset Marketplace (VCOM). Built for Flare Hackathon.
      </div>
    </footer>
  );
};

export default Footer; 