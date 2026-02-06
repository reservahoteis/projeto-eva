# MCP Server Development Best Practices and Guidelines

## Overview

This document compiles essential best practices and guidelines for building Model Context Protocol (MCP) servers. It covers naming conventions, tool design, response formats, pagination, error handling, security, and compliance requirements.

---

## Quick Reference

### Server Naming

- **Python**: `{service}_mcp` (e.g., `slack_mcp`)
- **Node/TypeScript**: `{service}-mcp-server` (e.g., `slack-mcp-server`)

### Tool Naming

- Use snake_case with service prefix
- Format: `{service}_{action}_{resource}`
- Example: `slack_send_message`, `github_create_issue`

### Response Formats

- Support both JSON and Markdown formats
- JSON for programmatic processing
- Markdown for human readability

### Pagination

- Always respect `limit` parameter
- Return `has_more`, `next_offset`, `total_count`
- Default to 20-50 items

### Character Limits

- Set CHARACTER_LIMIT constant (typically 25,000)
- Truncate gracefully with clear messages
- Provide guidance on filtering

---

## Table of Contents

1. Server Naming Conventions
2. Tool Naming and Design
3. Response Format Guidelines
4. Pagination Best Practices
5. Character Limits and Truncation
6. Tool Development Best Practices
7. Transport Best Practices
8. Testing Requirements
9. OAuth and Security Best Practices
10. Resource Management Best Practices
11. Prompt Management Best Practices
12. Error Handling Standards
13. Documentation Requirements
14. Compliance and Monitoring

---

## 1. Server Naming Conventions

Follow these standardized naming patterns for MCP servers:

**Python**: Use format `{service}_mcp` (lowercase with underscores)

- Examples: `slack_mcp`, `github_mcp`, `jira_mcp`, `stripe_mcp`

**Node/TypeScript**: Use format `{service}-mcp-server` (lowercase with hyphens)

- Examples: `slack-mcp-server`, `github-mcp-server`, `jira-mcp-server`

The name should be:

- General (not tied to specific features)
- Descriptive of the service/API being integrated
- Easy to infer from the task description
- Without version numbers or dates

---

## 2. Tool Naming and Design

### Tool Naming Best Practices

1. **Use snake_case**: `search_users`, `create_project`, `get_channel_info`
2. **Include service prefix**: Anticipate that your MCP server may be used alongside other MCP servers
   - Use `slack_send_message` instead of just `send_message`
   - Use `github_create_issue` instead of just `create_issue`
   - Use `asana_list_tasks` instead of just `list_tasks`
3. **Be action-oriented**: Start with verbs (get, list, search, create, etc.)
4. **Be specific**: Avoid generic names that could conflict with other servers
5. **Maintain consistency**: Use consistent naming patterns within your server

### Tool Design Guidelines

- Tool descriptions must narrowly and unambiguously describe functionality
- Descriptions must precisely match actual functionality
- Should not create confusion with other MCP servers
- Should provide tool annotations (readOnlyHint, destructiveHint, idempotentHint, openWorldHint)
- Keep tool operations focused and atomic

---

## 3. Response Format Guidelines

All tools that return data should support multiple formats for flexibility:

### JSON Format (`response_format="json"`)

- Machine-readable structured data
- Include all available fields and metadata
- Consistent field names and types
- Suitable for programmatic processing
- Use for when LLMs need to process data further

### Markdown Format (`response_format="markdown"`, typically default)

- Human-readable formatted text
- Use headers, lists, and formatting for clarity
- Convert timestamps to human-readable format (e.g., "2024-01-15 10:30:00 UTC" instead of epoch)
- Show display names with IDs in parentheses (e.g., "@john.doe (U123456)")
- Omit verbose metadata (e.g., show only one profile image URL, not all sizes)
- Group related information logically
- Use for when presenting information to users

---

## 4. Pagination Best Practices

For tools that list resources:

- **Always respect the `limit` parameter**: Never load all results when a limit is specified
- **Implement pagination**: Use `offset` or cursor-based pagination
- **Return pagination metadata**: Include `has_more`, `next_offset`/`next_cursor`, `total_count`
- **Never load all results into memory**: Especially important for large datasets
- **Default to reasonable limits**: 20-50 items is typical
- **Include clear pagination info in responses**: Make it easy for LLMs to request more data

Example pagination response structure:

```json
{
  "total": 150,
  "count": 20,
  "offset": 0,
  "items": [...],
  "has_more": true,
  "next_offset": 20
}
```

---

## 5. Character Limits and Truncation

To prevent overwhelming responses with too much data:

- **Define CHARACTER_LIMIT constant**: Typically 25,000 characters at module level
- **Check response size before returning**: Measure the final response length
- **Truncate gracefully with clear indicators**: Let the LLM know data was truncated
- **Provide guidance on filtering**: Suggest how to use parameters to reduce results
- **Include truncation metadata**: Show what was truncated and how to get more

Example truncation handling:

```python
CHARACTER_LIMIT = 25000

if len(result) > CHARACTER_LIMIT:
    truncated_data = data[:max(1, len(data) // 2)]
    response["truncated"] = True
    response["truncation_message"] = (
        f"Response truncated from {len(data)} to {len(truncated_data)} items. "
        f"Use 'offset' parameter or add filters to see more results."
    )
```

---

## 6. Transport Options

MCP servers support multiple transport mechanisms for different deployment scenarios:

### Stdio Transport

**Best for**: Command-line tools, local integrations, subprocess execution

**Characteristics**:

- Standard input/output stream communication
- Simple setup, no network configuration needed
- Runs as a subprocess of the client
- Ideal for desktop applications and CLI tools

**Use when**:

- Building tools for local development environments
- Integrating with desktop applications (e.g., Claude Desktop)
- Creating command-line utilities
- Single-user, single-session scenarios

### HTTP Transport

**Best for**: Web services, remote access, multi-client scenarios

**Characteristics**:

- Request-response pattern over HTTP
- Supports multiple simultaneous clients
- Can be deployed as a web service
- Requires network configuration and security considerations

**Use when**:

- Serving multiple clients simultaneously
- Deploying as a cloud service
- Integration with web applications
- Need for load balancing or scaling

### Server-Sent Events (SSE) Transport

**Best for**: Real-time updates, push notifications, streaming data

**Characteristics**:

- One-way server-to-client streaming over HTTP
- Enables real-time updates without polling
- Long-lived connections for continuous data flow
- Built on standard HTTP infrastructure

**Use when**:

- Clients need real-time data updates
- Implementing push notifications
- Streaming logs or monitoring data
- Progressive result delivery for long operations

### Transport Selection Criteria

| Criterion | Stdio | HTTP | SSE |
|-----------|-------|------|-----|
| **Deployment** | Local | Remote | Remote |
| **Clients** | Single | Multiple | Multiple |
| **Communication** | Bidirectional | Request-Response | Server-Push |
| **Complexity** | Low | Medium | Medium-High |
| **Real-time** | No | No | Yes |

---

## 7. Tool Development Best Practices

### General Guidelines

1. Tool names should be descriptive and action-oriented
2. Use parameter validation with detailed JSON schemas
3. Include examples in tool descriptions
4. Implement proper error handling and validation
5. Use progress reporting for long operations
6. Keep tool operations focused and atomic
7. Document expected return value structures
8. Implement proper timeouts
9. Consider rate limiting for resource-intensive operations
10. Log tool usage for debugging and monitoring

### Security Considerations for Tools

#### Input Validation

- Validate all parameters against schema
- Sanitize file paths and system commands
- Validate URLs and external identifiers
- Check parameter sizes and ranges
- Prevent command injection

#### Access Control

- Implement authentication where needed
- Use appropriate authorization checks
- Audit tool usage
- Rate limit requests
- Monitor for abuse

#### Error Handling

- Don't expose internal errors to clients
- Log security-relevant errors
- Handle timeouts appropriately
- Clean up resources after errors
- Validate return values

### Tool Annotations

- Provide readOnlyHint and destructiveHint annotations
- Remember annotations are hints, not security guarantees
- Clients should not make security-critical decisions based solely on annotations

---

## 8. Transport Best Practices

### General Transport Guidelines

1. Handle connection lifecycle properly
2. Implement proper error handling
3. Use appropriate timeout values
4. Implement connection state management
5. Clean up resources on disconnection

### Security Best Practices for Transport

- Follow security considerations for DNS rebinding attacks
- Implement proper authentication mechanisms
- Validate message formats
- Handle malformed messages gracefully

### Stdio Transport Specific

- Local MCP servers should NOT log to stdout (interferes with protocol)
- Use stderr for logging messages
- Handle standard I/O streams properly

---

## 9. Testing Requirements

A comprehensive testing strategy should cover:

### Functional Testing

- Verify correct execution with valid/invalid inputs

### Integration Testing

- Test interaction with external systems

### Security Testing

- Validate auth, input sanitization, rate limiting

### Performance Testing

- Check behavior under load, timeouts

### Error Handling

- Ensure proper error reporting and cleanup

---

## 10. OAuth and Security Best Practices

### Authentication and Authorization

MCP servers that connect to external services should implement proper authentication:

**OAuth 2.1 Implementation:**

- Use secure OAuth 2.1 with certificates from recognized authorities
- Validate access tokens before processing requests
- Only accept tokens specifically intended for your server
- Reject tokens without proper audience claims
- Never pass through tokens received from MCP clients

**API Key Management:**

- Store API keys in environment variables, never in code
- Validate keys on server startup
- Provide clear error messages when authentication fails
- Use secure transmission for sensitive credentials

### Input Validation and Security

**Always validate inputs:**

- Sanitize file paths to prevent directory traversal
- Validate URLs and external identifiers
- Check parameter sizes and ranges
- Prevent command injection in system calls
- Use schema validation (Pydantic/Zod) for all inputs

**Error handling security:**

- Don't expose internal errors to clients
- Log security-relevant errors server-side
- Provide helpful but not revealing error messages
- Clean up resources after errors

### Privacy and Data Protection

**Data collection principles:**

- Only collect data strictly necessary for functionality
- Don't collect extraneous conversation data
- Don't collect PII unless explicitly required for the tool's purpose
- Provide clear information about what data is accessed

**Data transmission:**

- Don't send data to servers outside your organization without disclosure
- Use secure transmission (HTTPS) for all network communication
- Validate certificates for external services

---

## 11. Resource Management Best Practices

1. Only suggest necessary resources
2. Use clear, descriptive names for roots
3. Handle resource boundaries properly
4. Respect client control over resources
5. Use model-controlled primitives (tools) for automatic data exposure

---

## 12. Prompt Management Best Practices

- Clients should show users proposed prompts
- Users should be able to modify or reject prompts
- Clients should show users completions
- Users should be able to modify or reject completions
- Consider costs when using sampling

---

## 13. Error Handling Standards

- Use standard JSON-RPC error codes
- Report tool errors within result objects (not protocol-level)
- Provide helpful, specific error messages
- Don't expose internal implementation details
- Clean up resources properly on errors

---

## 14. Documentation Requirements

- Provide clear documentation of all tools and capabilities
- Include working examples (at least 3 per major feature)
- Document security considerations
- Specify required permissions and access levels
- Document rate limits and performance characteristics

---

## 15. Compliance and Monitoring

- Implement logging for debugging and monitoring
- Track tool usage patterns
- Monitor for potential abuse
- Maintain audit trails for security-relevant operations
- Be prepared for ongoing compliance reviews

---

## Summary

These best practices represent the comprehensive guidelines for building secure, efficient, and compliant MCP servers that work well within the ecosystem. Developers should follow these guidelines to ensure their MCP servers meet the standards for inclusion in the MCP directory and provide a safe, reliable experience for users.
