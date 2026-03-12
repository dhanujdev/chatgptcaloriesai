import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";

import { normalizeDate } from "@/app/lib/date-utils";
import type { DashboardPayload } from "@/app/lib/dashboard-types";
import { baseURL } from "@/baseUrl";

import { createDashboardRepository } from "./repositories";

const WIDGET_URI = "ui://calories/dashboard.html";

const openDashboardInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const loadDaySnapshotInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "content-type, mcp-session-id",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toolStatus(invoking: string, invoked: string) {
  return {
    "openai/toolInvocation/invoking": invoking,
    "openai/toolInvocation/invoked": invoked,
  } as const;
}

function withCorsHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [header, value] of Object.entries(CORS_HEADERS)) {
    headers.set(header, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function getWidgetHtml() {
  const response = await fetch(`${baseURL}/`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Failed to resolve widget HTML from ${baseURL}/`);
  }

  return response.text();
}

function createAppServer() {
  const { repository, mode } = createDashboardRepository();

  const server = new McpServer({
    name: "chatgpt-calories-ai",
    version: "0.1.0",
  });

  registerAppResource(
    server,
    "calorie-dashboard-widget",
    WIDGET_URI,
    {
      title: "Calorie Dashboard Widget",
      description: "Interactive calorie dashboard rendered in ChatGPT",
      _meta: {
        ui: {
          prefersBorder: true,
          csp: {
            connectDomains: [],
            resourceDomains: [],
          },
        },
      },
    },
    async () => ({
      contents: [
        {
          uri: WIDGET_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: await getWidgetHtml(),
          _meta: {
            ui: {
              prefersBorder: true,
              csp: {
                connectDomains: [],
                resourceDomains: [],
              },
            },
            "openai/widgetDescription":
              "Calorie Command dashboard with calorie ring, macro cards, and weekly trend.",
          },
        },
      ],
    })
  );

  registerAppTool(
    server,
    "open_calorie_dashboard",
    {
      title: "Open calorie dashboard",
      description: "Open or refresh the calorie dashboard for the requested date.",
      inputSchema: openDashboardInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true,
      },
      _meta: {
        ui: {
          resourceUri: WIDGET_URI,
          visibility: ["model", "app"],
        },
        ...toolStatus("Loading dashboard", "Dashboard loaded"),
      },
    },
    async ({ date }) => {
      const snapshot = await repository.getDashboardSnapshot(normalizeDate(date));
      const payload: DashboardPayload = {
        kind: "dashboard",
        dashboard: snapshot,
      };

      return {
        structuredContent: payload,
        content: [
          {
            type: "text" as const,
            text:
              `Opened calorie dashboard for ${snapshot.date}. ` +
              `${Math.round(snapshot.summary.totals.calories)} of ${snapshot.summary.targets.calories} kcal logged. ` +
              `(${mode} data source)`,
          },
        ],
      };
    }
  );

  registerAppTool(
    server,
    "load_day_snapshot",
    {
      title: "Load day snapshot",
      description: "Load dashboard state for a specific date while keeping the same widget mounted.",
      inputSchema: loadDaySnapshotInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true,
      },
      _meta: {
        ui: {
          visibility: ["model", "app"],
        },
        ...toolStatus("Loading day", "Day loaded"),
      },
    },
    async ({ date }) => {
      const snapshot = await repository.getDashboardSnapshot(normalizeDate(date));
      const payload: DashboardPayload = {
        kind: "dashboard",
        dashboard: snapshot,
      };

      return {
        structuredContent: payload,
        content: [
          {
            type: "text" as const,
            text: `Loaded ${snapshot.date} snapshot. ${Math.round(snapshot.summary.remaining.calories)} kcal remaining.`,
          },
        ],
      };
    }
  );

  return server;
}

async function handleMcpRequest(request: Request) {
  const server = createAppServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    const response = await transport.handleRequest(request);
    return withCorsHeaders(response);
  } catch (error) {
    console.error("Failed to handle MCP request", error);
    return new Response("Internal server error", {
      status: 500,
      headers: CORS_HEADERS,
    });
  } finally {
    await transport.close();
    await server.close();
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function GET(request: Request) {
  return handleMcpRequest(request);
}

export async function POST(request: Request) {
  return handleMcpRequest(request);
}

export async function DELETE(request: Request) {
  return handleMcpRequest(request);
}
