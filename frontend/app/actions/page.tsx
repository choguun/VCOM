import React from 'react';
import { Button } from '@/components/ui/button';

const ActionsPage = () => {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Verifiable Actions</h1>
      <p className="text-muted-foreground mb-6">
        Verify real-world environmental actions using Flare's FDC protocol.
        Successfully verified actions can potentially be used for minting Carbon Credits (future feature).
      </p>

      {/* Example Action Section */}
      <div className="border rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-3">Check Seoul Temperature</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Verify if the current temperature in Seoul is above 15°C using an external weather API and FDC.
        </p>
        <Button>
          Trigger Verification Check
        </Button>
        {/* Placeholder for status display */}
        <div className="mt-4 text-sm text-muted-foreground">
          Verification status will appear here...
        </div>
      </div>

      {/* Placeholder for Action History */}
      <h2 className="text-2xl font-semibold mb-4 border-t pt-6">Action History</h2>
      <div className="border rounded-lg p-8 text-center text-muted-foreground">
        Your verified action history will appear here...
      </div>

    </div>
  );
};

export default ActionsPage; 