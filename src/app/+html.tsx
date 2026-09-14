import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />

        <meta name="theme-color" content="#7c3aed" />
        <meta
          name="application-name"
          content="Weather Forecast Validation"
        />
        <meta
          name="apple-mobile-web-app-capable"
          content="yes"
        />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="default"
        />
        <meta
          name="apple-mobile-web-app-title"
          content="Weather Validation"
        />

        <link rel="manifest" href="/manifest.json" />
        <link
          rel="apple-touch-icon"
          href="/apple-touch-icon.png"
        />

        <ScrollViewStyleReset />
      </head>

      <body>{children}</body>
    </html>
  );
}
