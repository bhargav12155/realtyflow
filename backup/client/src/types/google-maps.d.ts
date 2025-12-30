declare global {
  interface Window {
    google: typeof google;
  }
}

declare namespace google {
  namespace maps {
    namespace places {
      class Autocomplete {
        constructor(
          input: HTMLInputElement,
          options?: {
            types?: string[];
            componentRestrictions?: { country: string };
            fields?: string[];
          }
        );
        addListener(eventName: string, handler: () => void): void;
        getPlace(): {
          formatted_address?: string;
          address_components?: Array<{
            long_name: string;
            short_name: string;
            types: string[];
          }>;
        };
      }
    }
  }
}

export {};