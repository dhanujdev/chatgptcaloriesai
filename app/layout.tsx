import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { baseURL } from "@/baseUrl";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Calorie Command",
  description: "ChatGPT calorie dashboard app with MCP tools and widget UI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <NextChatSDKBootstrap baseUrl={baseURL} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

function NextChatSDKBootstrap({ baseUrl }: { baseUrl: string }) {
  return (
    <>
      <base href={baseUrl}></base>
      <script>{`window.innerBaseUrl = ${JSON.stringify(baseUrl)}`}</script>
      <script>{`window.__isChatGptApp = typeof window.openai !== "undefined";`}</script>
      <script>
        {"(" +
          (() => {
            try {
              const baseUrl = window.innerBaseUrl;
              const appOrigin = new URL(baseUrl, window.location.href).origin;
              const htmlElement = document.documentElement;

              // ChatGPT may mutate root attributes before hydration. Keep the html element stable.
              const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                  if (
                    mutation.type === "attributes" &&
                    mutation.target === htmlElement
                  ) {
                    const attrName = mutation.attributeName;
                    if (
                      attrName &&
                      attrName !== "suppresshydrationwarning" &&
                      htmlElement.hasAttribute(attrName)
                    ) {
                      htmlElement.removeAttribute(attrName);
                    }
                  }
                });
              });

              observer.observe(htmlElement, {
                attributes: true,
                attributeOldValue: true,
              });

              const originalReplaceState = history.replaceState;
              history.replaceState = (state, unused, url) => {
                try {
                  const nextUrl = url == null ? null : new URL(url, window.location.href);
                  const href = nextUrl
                    ? nextUrl.pathname + nextUrl.search + nextUrl.hash
                    : null;
                  originalReplaceState.call(history, state, unused, href);
                } catch {
                  originalReplaceState.call(history, state, unused, url);
                }
              };

              const originalPushState = history.pushState;
              history.pushState = (state, unused, url) => {
                try {
                  const nextUrl = url == null ? null : new URL(url, window.location.href);
                  const href = nextUrl
                    ? nextUrl.pathname + nextUrl.search + nextUrl.hash
                    : null;
                  originalPushState.call(history, state, unused, href);
                } catch {
                  originalPushState.call(history, state, unused, url);
                }
              };

              window.addEventListener(
                "click",
                (e) => {
                  const target = e?.target;
                  if (!(target instanceof Element)) return;
                  const link = target.closest("a");
                  if (!link || !link.href) return;

                  let linkUrl: URL;
                  try {
                    linkUrl = new URL(link.href, window.location.href);
                  } catch {
                    return;
                  }

                  if (
                    linkUrl.origin !== window.location.origin &&
                    linkUrl.origin !== appOrigin
                  ) {
                    try {
                      if (window.openai?.openExternal) {
                        window.openai.openExternal({ href: link.href });
                        e.preventDefault();
                      }
                    } catch {
                      // no-op: in unsupported hosts, fall through to default navigation
                    }
                  }
                },
                true
              );

              const isInIframe = window.self !== window.top;
              if (isInIframe && window.location.origin !== appOrigin) {
                const originalFetch = window.fetch.bind(window);

                window.fetch = (input: URL | RequestInfo, init?: RequestInit) => {
                  try {
                    let url: URL;
                    if (typeof input === "string" || input instanceof URL) {
                      url = new URL(input, window.location.href);
                    } else {
                      url = new URL(input.url, window.location.href);
                    }

                    if (url.origin === appOrigin || url.origin === window.location.origin) {
                      if (url.origin === window.location.origin) {
                        const nextUrl = new URL(baseUrl, window.location.href);
                        nextUrl.pathname = url.pathname;
                        nextUrl.search = url.search;
                        nextUrl.hash = url.hash;
                        url = nextUrl;
                      }

                      const nextInput =
                        typeof input === "string" || input instanceof URL
                          ? url.toString()
                          : new Request(url.toString(), input);

                      return originalFetch(nextInput, { ...init, mode: "cors" });
                    }
                  } catch {
                    // Fall back to the native fetch behavior on any transformation error.
                  }

                  return originalFetch(input, init);
                };
              }
            } catch {
              // Prevent host crashes if the bootstrap patch cannot be applied in a client environment.
            }
          }).toString() +
          ")()"}
      </script>
    </>
  );
}
