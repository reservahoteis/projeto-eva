# Node/TypeScript MCP Server Implementation Guide

## Overview

This document provides Node/TypeScript-specific best practices and examples for implementing MCP servers using the MCP TypeScript SDK. It covers project structure, server setup, tool registration patterns, input validation with Zod, error handling, and complete working examples.

---

## Quick Reference

### Key Imports

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import axios, { AxiosError } from "axios";
```

### Server Initialization

```typescript
const server = new McpServer({
  name: "service-mcp-server",
  version: "1.0.0"
});
```

### Tool Registration Pattern

```typescript
server.registerTool("tool_name", {...config}, async (params) => {
  // Implementation
});
```

---

## MCP TypeScript SDK

The official MCP TypeScript SDK provides:

- `McpServer` class for server initialization
- `registerTool` method for tool registration
- Zod schema integration for runtime input validation
- Type-safe tool handler implementations

See the MCP SDK documentation in the references for complete details.

## Server Naming Convention

Node/TypeScript MCP servers must follow this naming pattern:

- **Format**: `{service}-mcp-server` (lowercase with hyphens)
- **Examples**: `github-mcp-server`, `jira-mcp-server`, `stripe-mcp-server`

The name should be:

- General (not tied to specific features)
- Descriptive of the service/API being integrated
- Easy to infer from the task description
- Without version numbers or dates

## Project Structure

Create the following structure for Node/TypeScript MCP servers:

```
{service}-mcp-server/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── index.ts          # Main entry point with McpServer initialization
│   ├── types.ts          # TypeScript type definitions and interfaces
│   ├── tools/            # Tool implementations (one file per domain)
│   ├── services/         # API clients and shared utilities
│   ├── schemas/          # Zod validation schemas
│   └── constants.ts      # Shared constants (API_URL, CHARACTER_LIMIT, etc.)
└── dist/                 # Built JavaScript files (entry point: dist/index.js)
```

## Tool Implementation

### Tool Naming

Use snake_case for tool names (e.g., "search_users", "create_project", "get_channel_info") with clear, action-oriented names.

**Avoid Naming Conflicts**: Include the service context to prevent overlaps:

- Use "slack_send_message" instead of just "send_message"
- Use "github_create_issue" instead of just "create_issue"
- Use "asana_list_tasks" instead of just "list_tasks"

### Tool Structure

Tools are registered using the `registerTool` method with the following requirements:

- Use Zod schemas for runtime input validation and type safety
- The `description` field must be explicitly provided - JSDoc comments are NOT automatically extracted
- Explicitly provide `title`, `description`, `inputSchema`, and `annotations`
- The `inputSchema` must be a Zod schema object (not a JSON schema)
- Type all parameters and return values explicitly

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({
  name: "example-mcp",
  version: "1.0.0"
});

// Zod schema for input validation
const UserSearchInputSchema = z.object({
  query: z.string()
    .min(2, "Query must be at least 2 characters")
    .max(200, "Query must not exceed 200 characters")
    .describe("Search string to match against names/emails"),
  limit: z.number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Maximum results to return"),
  offset: z.number()
    .int()
    .min(0)
    .default(0)
    .describe("Number of results to skip for pagination"),
  response_format: z.nativeEnum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable")
}).strict();

// Type definition from Zod schema
type UserSearchInput = z.infer<typeof UserSearchInputSchema>;

server.registerTool(
  "example_search_users",
  {
    title: "Search Example Users",
    description: `Search for users in the Example system by name, email, or team.

This tool searches across all user profiles in the Example platform, supporting partial matches and various search filters.

Args:
  - query (string): Search string to match against names/emails
  - limit (number): Maximum results to return, between 1-100 (default: 20)
  - offset (number): Number of results to skip for pagination (default: 0)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON format: Structured data with schema:
  {
    "total": number,
    "count": number,
    "offset": number,
    "users": [...],
    "has_more": boolean,
    "next_offset": number
  }

Examples:
  - Use when: "Find all marketing team members" -> params with query="team:marketing"
  - Use when: "Search for John's account" -> params with query="john"`,
    inputSchema: UserSearchInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: UserSearchInput) => {
    try {
      const data = await makeApiRequest<any>(
        "users/search",
        "GET",
        undefined,
        { q: params.query, limit: params.limit, offset: params.offset }
      );

      const users = data.users || [];
      const total = data.total || 0;

      if (!users.length) {
        return {
          content: [{
            type: "text",
            text: `No users found matching '${params.query}'`
          }]
        };
      }

      // Format response based on requested format
      let result: string;
      if (params.response_format === ResponseFormat.MARKDOWN) {
        const lines: string[] = [`# User Search Results: '${params.query}'`, ""];
        lines.push(`Found ${total} users (showing ${users.length})`);
        for (const user of users) {
          lines.push(`## ${user.name} (${user.id})`);
          lines.push(`- **Email**: ${user.email}`);
        }
        result = lines.join("\n");
      } else {
        result = JSON.stringify({ total, count: users.length, offset: params.offset, users }, null, 2);
      }

      return {
        content: [{ type: "text", text: result }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: handleApiError(error) }]
      };
    }
  }
);
```

## Zod Schemas for Input Validation

Zod provides runtime type validation:

```typescript
import { z } from "zod";

// Basic schema with validation
const CreateUserSchema = z.object({
  name: z.string()
    .min(1, "Name is required")
    .max(100, "Name must not exceed 100 characters"),
  email: z.string()
    .email("Invalid email format"),
  age: z.number()
    .int("Age must be a whole number")
    .min(0, "Age cannot be negative")
    .max(150, "Age cannot be greater than 150")
}).strict();  // Use .strict() to forbid extra fields

// Enums
enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json"
}

const SearchSchema = z.object({
  response_format: z.nativeEnum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format")
});

// Optional fields with defaults
const PaginationSchema = z.object({
  limit: z.number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Maximum results to return"),
  offset: z.number()
    .int()
    .min(0)
    .default(0)
    .describe("Number of results to skip")
});
```

## Error Handling

Provide clear, actionable error messages:

```typescript
import axios, { AxiosError } from "axios";

function handleApiError(error: unknown): string {
  if (error instanceof AxiosError) {
    if (error.response) {
      switch (error.response.status) {
        case 404:
          return "Error: Resource not found. Please check the ID is correct.";
        case 403:
          return "Error: Permission denied. You don't have access to this resource.";
        case 429:
          return "Error: Rate limit exceeded. Please wait before making more requests.";
        default:
          return `Error: API request failed with status ${error.response.status}`;
      }
    } else if (error.code === "ECONNABORTED") {
      return "Error: Request timed out. Please try again.";
    }
  }
  return `Error: Unexpected error occurred: ${error instanceof Error ? error.message : String(error)}`;
}
```

## Package Configuration

### package.json

```json
{
  "name": "{service}-mcp-server",
  "version": "1.0.0",
  "description": "MCP server for {Service} API integration",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "clean": "rm -rf dist"
  },
  "engines": {
    "node": ">=18"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.6.1",
    "axios": "^1.7.9",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "allowSyntheticDefaultImports": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Building and Running

Always build your TypeScript code before running:

```bash
# Build the project
npm run build

# Run the server
npm start

# Development with auto-reload
npm run dev
```

Always ensure `npm run build` completes successfully before considering the implementation complete.

## Quality Checklist

Before finalizing your Node/TypeScript MCP server implementation, ensure:

### Strategic Design

- [ ] Tools enable complete workflows, not just API endpoint wrappers
- [ ] Tool names reflect natural task subdivisions
- [ ] Response formats optimize for agent context efficiency
- [ ] Human-readable identifiers used where appropriate
- [ ] Error messages guide agents toward correct usage

### Implementation Quality

- [ ] FOCUSED IMPLEMENTATION: Most important and valuable tools implemented
- [ ] All tools registered using `registerTool` with complete configuration
- [ ] All tools include `title`, `description`, `inputSchema`, and `annotations`
- [ ] Annotations correctly set (readOnlyHint, destructiveHint, idempotentHint, openWorldHint)
- [ ] All tools use Zod schemas for runtime input validation with `.strict()` enforcement
- [ ] All Zod schemas have proper constraints and descriptive error messages
- [ ] All tools have comprehensive descriptions with explicit input/output types
- [ ] Descriptions include return value examples and complete schema documentation
- [ ] Error messages are clear, actionable, and educational

### TypeScript Quality

- [ ] TypeScript interfaces are defined for all data structures
- [ ] Strict TypeScript is enabled in tsconfig.json
- [ ] No use of `any` type - use `unknown` or proper types instead
- [ ] All async functions have explicit Promise<T> return types
- [ ] Error handling uses proper type guards (e.g., `axios.isAxiosError`, `z.ZodError`)

### Project Configuration

- [ ] Package.json includes all necessary dependencies
- [ ] Build script produces working JavaScript in dist/ directory
- [ ] Main entry point is properly configured as dist/index.js
- [ ] Server name follows format: `{service}-mcp-server`
- [ ] tsconfig.json properly configured with strict mode

### Code Quality

- [ ] Pagination is properly implemented where applicable
- [ ] Large responses check CHARACTER_LIMIT constant and truncate with clear messages
- [ ] Filtering options are provided for potentially large result sets
- [ ] All network operations handle timeouts and connection errors gracefully
- [ ] Common functionality is extracted into reusable functions
- [ ] Return types are consistent across similar operations

### Testing and Build

- [ ] `npm run build` completes successfully without errors
- [ ] dist/index.js created and executable
- [ ] Server runs: `node dist/index.js --help`
- [ ] All imports resolve correctly
- [ ] Sample tool calls work as expected
