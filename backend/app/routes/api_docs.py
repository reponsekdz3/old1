"""Advanced API Documentation Generator
Generates interactive API docs in multiple languages with full code examples, playgrounds, and language-specific SDK documentation."""

from flask import Blueprint, jsonify, request, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from typing import Dict, List, Any, Optional
import json
import hashlib
import secrets
from datetime import datetime

api_docs_bp = Blueprint('api_docs', __name__, url_prefix='/api/docs')

# Supported programming languages
SUPPORTED_LANGUAGES = {
    'curl': {
        'name': 'cURL',
        'color': '#000000',
        'bg': '#FFFFFF',
        'icon': 'terminal',
        'extension': '.sh',
        'install': '# No installation needed - cURL is pre-installed on most systems'
    },
    'python': {
        'name': 'Python',
        'color': '#3776AB',
        'bg': '#FFF7EA',
        'icon': 'code',
        'extension': '.py',
        'install': 'pip install vipchat requests',
        'pip': 'vipchat',
        'package_manager': 'pip'
    },
    'javascript': {
        'name': 'JavaScript/Node.js',
        'color': '#F7DF1E',
        'bg': '#FFFEF0',
        'icon': 'code',
        'extension': '.js',
        'install': 'npm install vipchat axios',
        'npm': 'vipchat',
        'package_manager': 'npm'
    },
    'typescript': {
        'name': 'TypeScript',
        'color': '#3178C6',
        'bg': '#F0F6FF',
        'icon': 'code',
        'extension': '.ts',
        'install': 'npm install vipchat axios && npm install -D @types/node',
        'npm': 'vipchat',
        'package_manager': 'npm'
    },
    'java': {
        'name': 'Java',
        'color': '#ED8B00',
        'bg': '#FFF0E0',
        'icon': 'code',
        'extension': '.java',
        'install': 'Maven: Add dependency to pom.xml or Gradle: implementation "app.vipchat:vipchat-java:2.0.0"',
        'maven': 'app.vipchat:vipchat-java',
        'gradle': 'implementation "app.vipchat:vipchat-java:2.0.0"',
        'package_manager': 'maven'
    },
    'go': {
        'name': 'Go',
        'color': '#00ADD8',
        'bg': '#E6F7FF',
        'icon': 'code',
        'extension': '.go',
        'install': 'go get github.com/vipchat/vipchat-go',
        'import': 'github.com/vipchat/vipchat-go',
        'package_manager': 'go'
    },
    'php': {
        'name': 'PHP',
        'color': '#777BB4',
        'bg': '#F5F5FF',
        'icon': 'code',
        'extension': '.php',
        'install': 'composer require vipchat/vipchat-php',
        'composer': 'vipchat/vipchat-php',
        'package_manager': 'composer'
    },
    'ruby': {
        'name': 'Ruby',
        'color': '#CC342D',
        'bg': '#FFE6E6',
        'icon': 'code',
        'extension': '.rb',
        'install': 'gem install vipchat',
        'gem': 'vipchat',
        'package_manager': 'gem'
    },
    'csharp': {
        'name': 'C#/.NET',
        'color': '#512BD4',
        'bg': '#F5EEFF',
        'icon': 'code',
        'extension': '.cs',
        'install': 'dotnet add package VipChat',
        'nuget': 'VipChat',
        'package_manager': 'nuget'
    },
    'swift': {
        'name': 'Swift',
        'color': '#F05138',
        'bg': '#FFF0EB',
        'icon': 'code',
        'extension': '.swift',
        'install': 'Add to Package.swift dependencies or via Xcode SPM',
        'swift_pkg': 'VipChat',
        'package_manager': 'spm'
    },
    'kotlin': {
        'name': 'Kotlin',
        'color': '#7F52FF',
        'bg': '#F3EEFF',
        'icon': 'code',
        'extension': '.kt',
        'install': 'implementation "app.vipchat:vipchat-kotlin:2.0.0"',
        'maven': 'app.vipchat:vipchat-kotlin',
        'gradle': 'implementation "app.vipchat:vipchat-kotlin:2.0.0"',
        'package_manager': 'gradle'
    }
}

# Complete API Documentation
API_DOCUMENTATION = {
    "meta": {
        "version": "2.0.0",
        "title": "VipChat Business API",
        "description": "Enterprise-grade messaging API for businesses. Send messages, manage contacts, create chatbots, and integrate VipChat into your applications.",
        "base_url": "https://api.vipchat.app",
        "contact": {
            "name": "VipChat API Support",
            "email": "api-support@vipchat.app",
            "url": "https://vipchat.app/api-platform"
        },
        "license": {
            "name": "Apache 2.0",
            "url": "https://www.apache.org/licenses/LICENSE-2.0"
        }
    },
    
    "authentication": {
        "type": "bearer",
        "description": "All API requests must include a valid API key in the Authorization header.",
        "header_format": "Authorization: Bearer vck_live_your_api_key",
        "security_schemes": {
            "bearer_auth": {
                "type": "http",
                "scheme": "bearer",
                "bearer_format": "API Key"
            },
            "api_key": {
                "type": "apiKey",
                "in": "header",
                "name": "X-API-Key"
            },
            "hmac_signature": {
                "type": "apiKey",
                "in": "header",
                "name": "X-Signature",
                "description": "HMAC-SHA256 signature for enterprise accounts"
            }
        }
    },
    
    "rate_limits": {
        "tiers": {
            "starter": {"daily_messages": 100, "per_second": 10, "price_usd": 0},
            "pro": {"daily_messages": 10000, "per_second": 50, "price_usd": 29},
            "enterprise": {"daily_messages": "unlimited", "per_second": 500, "price_usd": 99}
        },
        "headers": {
            "X-RateLimit-Limit": "Your daily message limit",
            "X-RateLimit-Remaining": "Messages remaining today",
            "X-RateLimit-Reset": "Unix timestamp when limit resets"
        }
    },
    
    "endpoints": [
        # ========== MESSAGING ==========
        {
            "group": "Messaging",
            "endpoints": [
                {
                    "method": "POST",
                    "path": "/v1/messages/send",
                    "summary": "Send a message to a VipChat user",
                    "description": "Send a text, image, video, or document message to any VipChat user by their phone number.",
                    "tags": ["Messages"],
                    "authentication": True,
                    "request_body": {
                        "content_type": "application/json",
                        "schema": {
                            "type": "object",
                            "required": ["to"],
                            "properties": {
                                "to": {
                                    "type": "string",
                                    "description": "Recipient phone number in E.164 format",
                                    "example": "+1234567890",
                                    "pattern": "^\\+[1-9]\\d{1,14}$"
                                },
                                "message": {
                                    "type": "string",
                                    "description": "Text message content (max 4096 characters)",
                                    "example": "Hello from VipChat API!",
                                    "max_length": 4096
                                },
                                "media_url": {
                                    "type": "string",
                                    "format": "uri",
                                    "description": "URL to media file (image, video, document)",
                                    "example": "https://example.com/image.jpg"
                                },
                                "media_type": {
                                    "type": "string",
                                    "enum": ["image", "video", "document", "audio"],
                                    "description": "Type of media being sent"
                                },
                                "reply_to": {
                                    "type": "string",
                                    "description": "Message ID to reply to",
                                    "example": "msg_abc123"
                                },
                                "priority": {
                                    "type": "string",
                                    "enum": ["normal", "high"],
                                    "default": "normal",
                                    "description": "Message delivery priority"
                                },
                                "metadata": {
                                    "type": "object",
                                    "description": "Custom metadata for tracking (max 1KB)",
                                    "example": {"campaign_id": "summer2024"}
                                }
                            }
                        }
                    },
                    "responses": {
                        "200": {
                            "description": "Message sent successfully",
                            "schema": {
                                "success": True,
                                "message_id": "msg_abc123xyz",
                                "to": "+1234567890",
                                "status": "sent",
                                "timestamp": "2026-06-03T12:00:00Z",
                                "delivery_estimate": "2026-06-03T12:00:05Z"
                            }
                        },
                        "400": {"description": "Invalid request - missing required fields"},
                        "401": {"description": "Invalid or missing API key"},
                        "404": {"description": "Recipient not found on VipChat"},
                        "429": {"description": "Rate limit exceeded"}
                    },
                    "examples": {
                        "curl": '''curl -X POST https://api.vipchat.app/v1/messages/send \\
  -H "Authorization: Bearer vck_live_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "+1234567890",
    "message": "Hello from VipChat API!"
  }' ''',
                        "python": '''import requests

response = requests.post(
    "https://api.vipchat.app/v1/messages/send",
    headers={
        "Authorization": "Bearer vck_live_your_api_key",
        "Content-Type": "application/json"
    },
    json={
        "to": "+1234567890",
        "message": "Hello from VipChat API!"
    }
)
print(response.json())''',
                        "javascript": '''const response = await fetch('https://api.vipchat.app/v1/messages/send', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer vck_live_your_api_key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    to: '+1234567890',
    message: 'Hello from VipChat API!'
  })
});
const data = await response.json();
console.log(data);''',
                        "java": '''import java.net.http.*;
import java.net.URI;

HttpClient client = HttpClient.newHttpClient();
String body = """
  {"to":"+1234567890","message":"Hello from VipChat API!"}
  """;
HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("https://api.vipchat.app/v1/messages/send"))
    .header("Authorization", "Bearer vck_live_your_api_key")
    .header("Content-Type", "application/json")
    .POST(HttpRequest.BodyPublishers.ofString(body))
    .build();
HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
System.out.println(response.body());''',
                        "go": '''package main

import (
    "bytes"
    "encoding/json"
    "net/http"
)

func main() {
    payload := map[string]string{
        "to":      "+1234567890",
        "message": "Hello from VipChat API!",
    }
    body, _ := json.Marshal(payload)
    
    req, _ := http.NewRequest("POST", "https://api.vipchat.app/v1/messages/send", bytes.NewBuffer(body))
    req.Header.Set("Authorization", "Bearer vck_live_your_api_key")
    req.Header.Set("Content-Type", "application/json")
    
    client := &http.Client{}
    resp, _ := client.Do(req)
    defer resp.Body.Close()
}''',
                        "php": '''<?php
$ch = curl_init('https://api.vipchat.app/v1/messages/send');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer vck_live_your_api_key',
    'Content-Type: application/json'
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
    'to' => '+1234567890',
    'message' => 'Hello from VipChat API!'
]));
$response = curl_exec($ch);
curl_close($ch);
echo $response;
?>''',
                        "ruby": '''require 'net/http'
require 'json'

uri = URI('https://api.vipchat.app/v1/messages/send')
http = Net::HTTP.new(uri.host, uri.port)
http.use_ssl = true

request = Net::HTTP::Post.new(uri.path)
request['Authorization'] = 'Bearer vck_live_your_api_key'
request['Content-Type'] = 'application/json'
request.body = { to: '+1234567890', message: 'Hello from VipChat API!' }.to_json

response = http.request(request)
puts response.body''',
                        "csharp": '''using System.Net.Http;
using System.Text;
using System.Text.Json;

var client = new HttpClient();
client.DefaultRequestHeaders.Add("Authorization", "Bearer vck_live_your_api_key");

var payload = new { to = "+1234567890", message = "Hello from VipChat API!" };
var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

var response = await client.PostAsync("https://api.vipchat.app/v1/messages/send", content);
var result = await response.Content.ReadAsStringAsync();
Console.WriteLine(result);'''
                    }
                },
                {
                    "method": "GET",
                    "path": "/v1/messages",
                    "summary": "List sent messages",
                    "description": "Retrieve a paginated list of messages sent through the API.",
                    "tags": ["Messages"],
                    "authentication": True,
                    "parameters": [
                        {"name": "limit", "in": "query", "type": "integer", "default": 50, "max": 200, "description": "Number of messages to return"},
                        {"name": "offset", "in": "query", "type": "integer", "default": 0, "description": "Pagination offset"},
                        {"name": "status", "in": "query", "type": "string", "enum": ["sent", "delivered", "read", "failed"], "description": "Filter by status"},
                        {"name": "start_date", "in": "query", "type": "string", "format": "date", "description": "Filter from date (ISO 8601)"},
                        {"name": "end_date", "in": "query", "type": "string", "format": "date", "description": "Filter to date (ISO 8601)"}
                    ],
                    "responses": {
                        "200": {
                            "description": "List of messages",
                            "schema": {
                                "messages": [],
                                "count": 0,
                                "offset": 0,
                                "has_more": True
                            }
                        }
                    },
                    "examples": {
                        "curl": "curl -X GET 'https://api.vipchat.app/v1/messages?limit=50' -H 'Authorization: Bearer vck_live_your_api_key'"
                    }
                },
                {
                    "method": "GET",
                    "path": "/v1/messages/{message_id}",
                    "summary": "Get message details",
                    "description": "Retrieve details of a specific message by ID.",
                    "tags": ["Messages"],
                    "authentication": True,
                    "parameters": [
                        {"name": "message_id", "in": "path", "required": True, "type": "string", "description": "Message ID"}
                    ],
                    "responses": {
                        "200": {
                            "description": "Message details",
                            "schema": {
                                "id": "msg_abc123",
                                "to": "+1234567890",
                                "status": "delivered",
                                "delivered_at": "2026-06-03T12:00:05Z",
                                "read_at": "2026-06-03T12:01:00Z"
                            }
                        }
                    }
                },
                {
                    "method": "POST",
                    "path": "/v1/broadcasts/send",
                    "summary": "Send broadcast message",
                    "description": "Send the same message to multiple recipients (up to 1000).",
                    "tags": ["Messages", "Broadcast"],
                    "authentication": True,
                    "request_body": {
                        "content_type": "application/json",
                        "schema": {
                            "type": "object",
                            "required": ["to", "message"],
                            "properties": {
                                "to": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                    "max_items": 1000,
                                    "description": "List of recipient phone numbers",
                                    "example": ["+1234567890", "+0987654321"]
                                },
                                "message": {"type": "string"},
                                "media_url": {"type": "string"},
                                "template_id": {
                                    "type": "string",
                                    "description": "Use a pre-approved template"
                                }
                            }
                        }
                    },
                    "responses": {
                        "200": {
                            "description": "Broadcast sent",
                            "schema": {
                                "success": True,
                                "sent": 98,
                                "failed": 2,
                                "failed_phones": ["+9990000000"],
                                "total_messages": 100
                            }
                        }
                    }
                }
            ]
        },
        
        # ========== CONTACTS ==========
        {
            "group": "Contacts",
            "endpoints": [
                {
                    "method": "POST",
                    "path": "/v1/contacts/import",
                    "summary": "Import and validate contacts",
                    "description": "Import contacts by phone number and check which are registered on VipChat.",
                    "tags": ["Contacts"],
                    "authentication": True,
                    "request_body": {
                        "schema": {
                            "type": "object",
                            "required": ["contacts"],
                            "properties": {
                                "contacts": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "phone": {"type": "string"},
                                            "name": {"type": "string"},
                                            "email": {"type": "string"}
                                        }
                                    },
                                    "max_items": 500
                                }
                            }
                        }
                    },
                    "responses": {
                        "200": {
                            "description": "Contacts processed",
                            "schema": {
                                "imported": 10,
                                "not_found": 5,
                                "contacts": [
                                    {"phone": "+1234567890", "user_id": "user_123", "name": "John Doe", "is_vipchat_user": True}
                                ],
                                "missing": ["+9990000000"]
                            }
                        }
                    },
                    "examples": {
                        "curl": '''curl -X POST https://api.vipchat.app/v1/contacts/import \\
  -H "Authorization: Bearer vck_live_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"contacts":[{"phone":"+1234567890","name":"John Doe"}]}' '''
                    }
                },
                {
                    "method": "GET",
                    "path": "/v1/contacts",
                    "summary": "List contacts",
                    "description": "Retrieve all contacts associated with your API account.",
                    "tags": ["Contacts"],
                    "authentication": True,
                    "parameters": [
                        {"name": "search", "in": "query", "type": "string", "description": "Search by name or phone"},
                        {"name": "limit", "in": "query", "type": "integer", "default": 100}
                    ],
                    "responses": {
                        "200": {
                            "description": "List of contacts",
                            "schema": {
                                "contacts": [],
                                "count": 0
                            }
                        }
                    }
                }
            ]
        },
        
        # ========== GROUPS ==========
        {
            "group": "Groups",
            "endpoints": [
                {
                    "method": "POST",
                    "path": "/v1/groups/create",
                    "summary": "Create a group",
                    "description": "Create a new group and optionally add members.",
                    "tags": ["Groups"],
                    "authentication": True,
                    "request_body": {
                        "schema": {
                            "type": "object",
                            "required": ["name"],
                            "properties": {
                                "name": {"type": "string", "max_length": 100, "description": "Group name"},
                                "description": {"type": "string", "max_length": 500},
                                "member_phones": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                    "max_items": 100,
                                    "description": "Phone numbers to add"
                                },
                                "settings": {
                                    "type": "object",
                                    "properties": {
                                        "only_admins_send": {"type": "boolean", "default": False},
                                        "only_admins_edit_info": {"type": "boolean", "default": True}
                                    }
                                }
                            }
                        }
                    },
                    "responses": {
                        "201": {
                            "description": "Group created",
                            "schema": {
                                "success": True,
                                "group_id": "grp_abc123",
                                "name": "My Group",
                                "member_count": 5,
                                "invite_link": "https://vipchat.app/join/abc123"
                            }
                        }
                    }
                },
                {
                    "method": "POST",
                    "path": "/v1/groups/{group_id}/members/add",
                    "summary": "Add members to group",
                    "tags": ["Groups"],
                    "authentication": True,
                    "request_body": {
                        "schema": {
                            "type": "object",
                            "required": ["phones"],
                            "properties": {
                                "phones": {"type": "array", "items": {"type": "string"}}
                            }
                        }
                    }
                },
                {
                    "method": "POST",
                    "path": "/v1/groups/{group_id}/messages",
                    "summary": "Send group message",
                    "tags": ["Groups"],
                    "authentication": True
                }
            ]
        },
        
        # ========== WEBHOOKS ==========
        {
            "group": "Webhooks",
            "endpoints": [
                {
                    "method": "POST",
                    "path": "/v1/webhooks/configure",
                    "summary": "Configure webhook URL",
                    "description": "Set up a webhook to receive real-time events when users respond to your messages.",
                    "tags": ["Webhooks"],
                    "authentication": True,
                    "request_body": {
                        "schema": {
                            "type": "object",
                            "required": ["url"],
                            "properties": {
                                "url": {"type": "string", "format": "uri", "description": "HTTPS URL to receive webhooks"},
                                "events": {
                                    "type": "array",
                                    "items": {"type": "string", "enum": ["message.received", "message.delivered", "message.read", "message.failed", "contact.added"]},
                                    "description": "Events to subscribe to (default: all)"
                                }
                            }
                        }
                    },
                    "responses": {
                        "200": {
                            "description": "Webhook configured",
                            "schema": {
                                "success": True,
                                "webhook_url": "https://yourapp.com/webhook",
                                "webhook_secret": "whsec_abc123...",
                                "events": ["message.received", "message.delivered"]
                            }
                        }
                    },
                    "webhook_payloads": {
                        "message.received": {
                            "event": "message.received",
                            "data": {
                                "from": "+1234567890",
                                "message_id": "msg_abc123",
                                "content": "Hello!",
                                "timestamp": "2026-06-03T12:00:00Z"
                            },
                            "signature": "sha256=..."
                        }
                    }
                },
                {
                    "method": "POST",
                    "path": "/v1/webhooks/test",
                    "summary": "Test webhook delivery",
                    "description": "Send a test event to your configured webhook URL.",
                    "tags": ["Webhooks"],
                    "authentication": True
                }
            ]
        },
        
        # ========== ANALYTICS ==========
        {
            "group": "Analytics",
            "endpoints": [
                {
                    "method": "GET",
                    "path": "/v1/analytics",
                    "summary": "Get usage analytics",
                    "description": "Retrieve API usage statistics and metrics.",
                    "tags": ["Analytics"],
                    "authentication": True,
                    "parameters": [
                        {"name": "days", "in": "query", "type": "integer", "default": 7, "max": 90},
                        {"name": "group_by", "in": "query", "type": "string", "enum": ["day", "hour"], "default": "day"}
                    ],
                    "responses": {
                        "200": {
                            "description": "Analytics data",
                            "schema": {
                                "period_days": 7,
                                "total_calls": 1542,
                                "total_messages": 8923,
                                "success_rate": 99.2,
                                "avg_latency_ms": 145,
                                "daily": [],
                                "by_endpoint": {
                                    "/v1/messages/send": 1200,
                                    "/v1/contacts/import": 342
                                },
                                "tier": "pro",
                                "daily_limit": 10000
                            }
                        }
                    }
                }
            ]
        },
        
        # ========== ACCOUNT ==========
        {
            "group": "Account",
            "endpoints": [
                {
                    "method": "GET",
                    "path": "/v1/account",
                    "summary": "Get account info",
                    "description": "Retrieve your API account details, tier, and usage.",
                    "tags": ["Account"],
                    "authentication": True,
                    "responses": {
                        "200": {
                            "description": "Account info",
                            "schema": {
                                "business_name": "Acme Corp",
                                "tier": "pro",
                                "is_active": True,
                                "daily_limit": 10000,
                                "today_used": 342,
                                "remaining_today": 9658,
                                "api_key_prefix": "vck_live_abc123...",
                                "webhook_url": "https://yourapp.com/webhook",
                                "created_at": "2026-01-01T00:00:00Z"
                            }
                        }
                    }
                }
            ]
        }
    ],
    
    # SDK Downloads
    "sdks": {
        "python": {
            "name": "vipchat-python",
            "version": "2.0.0",
            "install": "pip install vipchat",
            "github": "https://github.com/vipchat/vipchat-python",
            "docs": "https://docs.vipchat.app/python"
        },
        "javascript": {
            "name": "vipchat-node",
            "version": "2.0.0",
            "install": "npm install vipchat",
            "github": "https://github.com/vipchat/vipchat-node",
            "docs": "https://docs.vipchat.app/nodejs"
        },
        "go": {
            "name": "vipchat-go",
            "version": "2.0.0",
            "install": "go get github.com/vipchat/vipchat-go",
            "github": "https://github.com/vipchat/vipchat-go",
            "docs": "https://docs.vipchat.app/go"
        },
        "java": {
            "name": "vipchat-java",
            "version": "2.0.0",
            "install": "Maven: <dependency>...<dependency>",
            "github": "https://github.com/vipchat/vipchat-java",
            "docs": "https://docs.vipchat.app/java"
        }
    },
    
    # Pricing & Plans
    "pricing": {
        "plans": [
            {
                "id": "starter",
                "name": "Starter",
                "price": 0,
                "currency": "USD",
                "billing": "monthly",
                "features": [
                    "100 messages per day",
                    "Basic API access",
                    "Webhook support",
                    "Community support",
                    "Standard delivery"
                ],
                "limits": {
                    "daily_messages": 100,
                    "requests_per_second": 10,
                    "broadcast_recipients": 100,
                    "groups": 5
                }
            },
            {
                "id": "pro",
                "name": "Pro",
                "price": 29,
                "currency": "USD",
                "billing": "monthly",
                "popular": True,
                "features": [
                    "10,000 messages per day",
                    "Priority delivery",
                    "Advanced analytics",
                    "Email support",
                    "Webhook retries",
                    "Message templates"
                ],
                "limits": {
                    "daily_messages": 10000,
                    "requests_per_second": 50,
                    "broadcast_recipients": 1000,
                    "groups": 50
                }
            },
            {
                "id": "enterprise",
                "name": "Enterprise",
                "price": 99,
                "currency": "USD",
                "billing": "monthly",
                "features": [
                    "Unlimited messages",
                    "Dedicated support",
                    "SLA guarantee (99.9%)",
                    "Custom integrations",
                    "Priority routing",
                    "HMAC signature",
                    "White-label options",
                    "Dedicated account manager"
                ],
                "limits": {
                    "daily_messages": "unlimited",
                    "requests_per_second": 500,
                    "broadcast_recipients": 10000,
                    "groups": "unlimited"
                }
            }
        ],
        "addons": [
            {"id": "extra_messages", "name": "Extra 10K messages", "price": 10},
            {"id": "priority_support", "name": "Priority Support", "price": 50},
            {"id": "dedicated_ip", "name": "Dedicated IP", "price": 100}
        ]
    },
    
    # Error codes
    "errors": {
        "AUTH_REQUIRED": {"code": 401, "message": "API key is required"},
        "AUTH_INVALID": {"code": 401, "message": "Invalid API key"},
        "CLIENT_SUSPENDED": {"code": 403, "message": "API client is suspended"},
        "RATE_LIMIT_EXCEEDED": {"code": 429, "message": "Daily rate limit exceeded"},
        "USER_NOT_FOUND": {"code": 404, "message": "User not found on VipChat"},
        "INVALID_PHONE": {"code": 400, "message": "Invalid phone number format"},
        "MESSAGE_TOO_LONG": {"code": 400, "message": "Message exceeds maximum length"},
        "MEDIA_INVALID": {"code": 400, "message": "Invalid media URL or type"},
        "GROUP_LIMIT": {"code": 400, "message": "Group limit exceeded"},
        "WEBHOOK_FAILED": {"code": 502, "message": "Webhook delivery failed"}
    }
}


@api_docs_bp.route('/openapi.json', methods=['GET'])
def get_openapi_spec():
    """Get OpenAPI 3.0 specification"""
    return jsonify(API_DOCUMENTATION)


@api_docs_bp.route('/full', methods=['GET'])
def get_full_docs():
    """Get complete API documentation"""
    return jsonify(API_DOCUMENTATION)


@api_docs_bp.route('/endpoints', methods=['GET'])
def get_endpoints():
    """Get all endpoints grouped by category"""
    endpoints = []
    for group in API_DOCUMENTATION['endpoints']:
        for ep in group['endpoints']:
            endpoints.append({
                'group': group['group'],
                'method': ep['method'],
                'path': ep['path'],
                'summary': ep.get('summary', ''),
                'tags': ep.get('tags', [])
            })
    return jsonify({'endpoints': endpoints})


@api_docs_bp.route('/examples/<language>', methods=['GET'])
def get_language_examples(language):
    """Get code examples for a specific language"""
    language = language.lower()
    examples = []
    
    for group in API_DOCUMENTATION['endpoints']:
        for ep in group['endpoints']:
            if 'examples' in ep and language in ep['examples']:
                examples.append({
                    'method': ep['method'],
                    'path': ep['path'],
                    'code': ep['examples'][language]
                })
    
    return jsonify({'language': language, 'examples': examples})


@api_docs_bp.route('/sdks', methods=['GET'])
def get_sdks():
    """Get available SDKs"""
    return jsonify(API_DOCUMENTATION['sdks'])


@api_docs_bp.route('/pricing', methods=['GET'])
def get_pricing():
    """Get pricing information"""
    return jsonify(API_DOCUMENTATION['pricing'])


@api_docs_bp.route('/errors', methods=['GET'])
def get_error_codes():
    """Get all error codes"""
    return jsonify(API_DOCUMENTATION['errors'])
