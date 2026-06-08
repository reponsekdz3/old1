"""
API Documentation System
Features: Multilingual docs, interactive examples, purchase links, version control
"""

from flask import Blueprint, jsonify, request
from datetime import datetime
import uuid

docs_bp = Blueprint('docs', __name__, url_prefix='/api/docs')

# Multilingual documentation content
DOCS_CONTENT = {
    'en': {
        'meta': {
            'title': 'VipChat API Documentation',
            'description': 'Complete API reference for VipChat messaging platform',
            'version': '2.0.0',
            'base_url': 'https://api.vipchat.com',
        },
        'getting_started': {
            'title': 'Getting Started',
            'description': 'Learn how to authenticate and make your first API call',
            'steps': [
                {
                    'title': 'Create an API Key',
                    'description': 'Sign up and create your first API key from the dashboard',
                    'link': '/dashboard/api-keys'
                },
                {
                    'title': 'Choose Your Plan',
                    'description': 'Select a plan that fits your needs',
                    'link': '/pricing'
                },
                {
                    'title': 'Make Your First Request',
                    'description': 'Use your API key to authenticate requests',
                    'code_example': {
                        'bash': 'curl -X GET "https://api.vipchat.com/api/test/connection" \\\n  -H "X-API-Key: your_api_key"',
                        'javascript': "const response = await fetch('https://api.vipchat.com/api/test/connection', {\n  headers: { 'X-API-Key': 'your_api_key' }\n});\nconst data = await response.json();",
                        'python': "import requests\n\nresponse = requests.get(\n    'https://api.vipchat.com/api/test/connection',\n    headers={'X-API-Key': 'your_api_key'}\n)\nprint(response.json())",
                    }
                }
            ]
        },
        'authentication': {
            'title': 'Authentication',
            'description': 'All API requests require authentication via API key',
            'header': 'X-API-Key',
            'example': 'Authorization: Bearer your_api_key',
            'types': [
                {
                    'name': 'API Key Authentication',
                    'description': 'Include your API key in the X-API-Key header',
                    'code': 'curl -H "X-API-Key: vipchat_test_xxxxxxxx" https://api.vipchat.com/api/test/connection'
                },
                {
                    'name': 'JWT Token',
                    'description': 'For user-specific operations, use JWT tokens',
                    'code': 'curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9..." https://api.vipchat.com/api/auth/user'
                }
            ]
        },
        'endpoints': {
            'title': 'API Endpoints',
            'description': 'Complete list of available API endpoints',
            'categories': [
                {
                    'name': 'Authentication',
                    'icon': 'shield',
                    'endpoints': [
                        {
                            'method': 'POST',
                            'path': '/api/auth/login',
                            'description': 'Login with phone and password',
                            'body': {
                                'phone': '+1234567890',
                                'password': 'your_password'
                            },
                            'response': {
                                'access_token': 'eyJ...',
                                'refresh_token': 'ref_...',
                                'user': {'id': '123', 'full_name': 'John'}
                            }
                        },
                        {
                            'method': 'POST',
                            'path': '/api/auth/signup',
                            'description': 'Register new user',
                            'body': {
                                'phone': '+1234567890',
                                'password': 'your_password',
                                'full_name': 'John Doe'
                            },
                            'response': {
                                'access_token': 'eyJ...',
                                'user': {'id': '123', 'full_name': 'John Doe'}
                            }
                        },
                        {
                            'method': 'GET',
                            'path': '/api/auth/user',
                            'description': 'Get current user profile',
                            'headers': {'Authorization': 'Bearer token'},
                            'response': {
                                'id': '123',
                                'full_name': 'John Doe',
                                'phone': '+1234567890',
                                'avatar_url': 'https://...'
                            }
                        }
                    ]
                },
                {
                    'name': 'Messages',
                    'icon': 'message',
                    'endpoints': [
                        {
                            'method': 'GET',
                            'path': '/api/messages/chat/:id',
                            'description': 'Get chat history with a user',
                            'query': {'limit': 50, 'before': 'message_id'},
                            'response': {
                                'messages': [
                                    {
                                        'id': 'msg_123',
                                        'sender_id': '123',
                                        'content': 'Hello!',
                                        'created_at': '2024-01-01T00:00:00Z'
                                    }
                                ]
                            }
                        },
                        {
                            'method': 'POST',
                            'path': '/api/messages/:id',
                            'description': 'Send a message',
                            'body': {
                                'receiver_id': '456',
                                'content': 'Hello!',
                                'media_url': 'optional'
                            },
                            'response': {
                                'message': {'id': 'msg_123', 'status': 'sent'}
                            }
                        }
                    ]
                },
                {
                    'name': 'Calls',
                    'icon': 'phone',
                    'endpoints': [
                        {
                            'method': 'POST',
                            'path': '/api/calls/initiate',
                            'description': 'Start a voice or video call',
                            'body': {
                                'callee_id': '456',
                                'call_type': 'video'
                            },
                            'response': {
                                'call_id': 'call_123',
                                'room_id': 'room_abc',
                                'ice_servers': [{'urls': 'stun:stun.l.google.com:19302'}]
                            }
                        },
                        {
                            'method': 'GET',
                            'path': '/api/calls/history',
                            'description': 'Get call history',
                            'response': {
                                'calls': [
                                    {
                                        'id': 'call_123',
                                        'caller_id': '123',
                                        'call_type': 'video',
                                        'duration': 120,
                                        'status': 'completed'
                                    }
                                ]
                            }
                        }
                    ]
                },
                {
                    'name': 'Contacts',
                    'icon': 'users',
                    'endpoints': [
                        {
                            'method': 'GET',
                            'path': '/api/contacts',
                            'description': 'Get contact list',
                            'response': {
                                'contacts': [
                                    {'id': '123', 'full_name': 'John', 'status': 'online'}
                                ]
                            }
                        },
                        {
                            'method': 'POST',
                            'path': '/api/contacts',
                            'description': 'Add new contact',
                            'body': {'phone': '+1234567890'}
                        }
                    ]
                },
                {
                    'name': 'Groups',
                    'icon': 'database',
                    'endpoints': [
                        {
                            'method': 'GET',
                            'path': '/api/groups',
                            'description': 'List user groups',
                            'response': {
                                'groups': [
                                    {'id': 'grp_1', 'name': 'Family', 'member_count': 5}
                                ]
                            }
                        },
                        {
                            'method': 'POST',
                            'path': '/api/groups',
                            'description': 'Create new group',
                            'body': {
                                'name': 'My Group',
                                'members': ['123', '456']
                            }
                        }
                    ]
                },
                {
                    'name': 'File Upload',
                    'icon': 'upload',
                    'endpoints': [
                        {
                            'method': 'POST',
                            'path': '/api/upload/image',
                            'description': 'Upload image file',
                            'body_type': 'multipart/form-data',
                            'response': {
                                'file_id': 'file_123',
                                'url': '/uploads/images/file_123.jpg',
                                'size': 102400
                            }
                        },
                        {
                            'method': 'POST',
                            'path': '/api/upload/video',
                            'description': 'Upload video file',
                            'body_type': 'multipart/form-data'
                        },
                        {
                            'method': 'POST',
                            'path': '/api/upload/audio',
                            'description': 'Upload audio/voice note',
                            'body_type': 'multipart/form-data'
                        }
                    ]
                },
                {
                    'name': 'Status Updates',
                    'icon': 'activity',
                    'endpoints': [
                        {
                            'method': 'GET',
                            'path': '/api/status/all',
                            'description': 'Get all status updates from contacts'
                        },
                        {
                            'method': 'POST',
                            'path': '/api/status',
                            'description': 'Post new status update',
                            'body': {
                                'content': 'My status',
                                'background_color': '#25D366'
                            }
                        }
                    ]
                }
            ]
        },
        'pricing': {
            'title': 'Pricing & Plans',
            'description': 'Choose the perfect plan for your needs',
            'plans': [
                {
                    'id': 'free',
                    'name': 'Free',
                    'price': 0,
                    'features': [
                        '100 API requests/hour',
                        '20 contacts',
                        '3 groups',
                        '2MB file uploads',
                        'Basic messaging'
                    ],
                    'limitations': ['No video calls', 'No API access']
                },
                {
                    'id': 'pro',
                    'name': 'Pro',
                    'price': 9.99,
                    'period': 'month',
                    'features': [
                        '1000 API requests/hour',
                        '200 contacts',
                        '50 groups',
                        '25MB file uploads',
                        'Video & voice calls',
                        'Status updates',
                        'Full API access'
                    ],
                    'cta': 'Get Pro'
                },
                {
                    'id': 'enterprise',
                    'name': 'Enterprise',
                    'price': 49.99,
                    'period': 'month',
                    'features': [
                        '10000 API requests/hour',
                        'Unlimited contacts',
                        'Unlimited groups',
                        '100MB file uploads',
                        'Priority support',
                        'Webhooks',
                        'Custom integrations'
                    ],
                    'cta': 'Contact Sales'
                }
            ]
        },
        'sdks': {
            'title': 'SDKs & Libraries',
            'description': 'Official libraries for popular programming languages',
            'languages': [
                {
                    'name': 'JavaScript/Node.js',
                    'icon': 'javascript',
                    'install': 'npm install @vipchat/sdk',
                    'example': "import { VipChat } from '@vipchat/sdk';\n\nconst client = new VipChat('your_api_key');\n\nconst messages = await client.messages.list('chat_123');\nawait client.messages.send({\n  receiver_id: '456',\n  content: 'Hello!'\n});",
                    'docs_link': '/docs/sdk/javascript'
                },
                {
                    'name': 'Python',
                    'icon': 'python',
                    'install': 'pip install vipchat-sdk',
                    'example': "from vipchat import VipChat\n\nclient = VipChat('your_api_key')\n\nmessages = client.messages.list('chat_123')\nclient.messages.send(receiver_id='456', content='Hello!')",
                    'docs_link': '/docs/sdk/python'
                },
                {
                    'name': 'React Native',
                    'icon': 'react',
                    'install': 'npx expo install vipchat-rn',
                    'example': "import { VipChatProvider, useVipChat } from 'vipchat-rn';\n\nfunction App() {\n  return (\n    <VipChatProvider apiKey=\"your_key\">\n      <ChatScreen />\n    </VipChatProvider>\n  );\n}",
                    'docs_link': '/docs/sdk/react-native'
                }
            ]
        },
        'errors': {
            'title': 'Error Handling',
            'description': 'Understanding API error responses',
            'codes': [
                {'code': 400, 'name': 'Bad Request', 'description': 'Invalid request body or parameters'},
                {'code': 401, 'name': 'Unauthorized', 'description': 'Invalid or missing API key'},
                {'code': 403, 'name': 'Forbidden', 'description': 'Insufficient permissions'},
                {'code': 404, 'name': 'Not Found', 'description': 'Resource not found'},
                {'code': 429, 'name': 'Rate Limited', 'description': 'Too many requests'},
                {'code': 500, 'name': 'Server Error', 'description': 'Internal server error'}
            ],
            'example': {
                'error': 'Invalid API key',
                'code': 401,
                'message': 'The provided API key is invalid or expired'
            }
        },
        'webhooks': {
            'title': 'Webhooks',
            'description': 'Receive real-time notifications for events',
            'events': [
                {'event': 'message.received', 'description': 'New message received'},
                {'event': 'message.delivered', 'description': 'Message delivered to recipient'},
                {'event': 'call.ended', 'description': 'Call has ended'},
                {'event': 'user.online', 'description': 'User came online'},
                {'event': 'user.offline', 'description': 'User went offline'},
                {'event': 'group.created', 'description': 'New group created'}
            ],
            'security': 'Verify webhook signatures using the X-Webhook-Signature header'
        }
    },
    'es': {
        'meta': {
            'title': 'Documentación de API VipChat',
            'description': 'Referencia completa de API para la plataforma de mensajería VipChat',
            'version': '2.0.0',
            'base_url': 'https://api.vipchat.com',
        },
        'getting_started': {
            'title': 'Comenzando',
            'description': 'Aprende cómo autenticarte y hacer tu primera llamada API',
            'steps': [
                {
                    'title': 'Crear una Clave API',
                    'description': 'Regístrate y crea tu primera clave API desde el panel',
                    'link': '/dashboard/api-keys'
                },
                {
                    'title': 'Elige Tu Plan',
                    'description': 'Selecciona un plan que se adapte a tus necesidades',
                    'link': '/pricing'
                }
            ]
        },
        'authentication': {
            'title': 'Autenticación',
            'description': 'Todas las solicitudes de API requieren autenticación mediante clave API',
            'header': 'X-API-Key',
            'example': 'Authorization: Bearer tu_clave_api'
        },
        'pricing': {
            'title': 'Precios y Planes',
            'description': 'Elige el plan perfecto para tus necesidades',
            'plans': [
                {'id': 'free', 'name': 'Gratis', 'price': 0},
                {'id': 'pro', 'name': 'Pro', 'price': 9.99, 'period': 'mes'},
                {'id': 'enterprise', 'name': 'Empresarial', 'price': 49.99, 'period': 'mes'}
            ]
        }
    },
    'ar': {
        'meta': {
            'title': 'وثائق API فيب شات',
            'description': 'مرجع API كامل لمنصة المراسلة فيب شات',
            'version': '2.0.0',
            'base_url': 'https://api.vipchat.com',
        },
        'getting_started': {
            'title': 'البدء',
            'description': 'تعلم كيفية المصادقة وإجراء أول طلب API',
            'steps': [
                {'title': 'إنشاء مفتاح API', 'description': 'سجل وأنشئ مفتاح API الأول'},
                {'title': 'اختر خطتك', 'description': 'اختر خطة تناسب احتياجاتك'}
            ]
        },
        'pricing': {
            'title': 'الأسعار والخطط',
            'description': 'اختر الخطة المثالية لاحتياجاتك',
            'plans': [
                {'id': 'free', 'name': 'مجاني', 'price': 0},
                {'id': 'pro', 'name': 'احترافي', 'price': 9.99},
                {'id': 'enterprise', 'name': 'مؤسسات', 'price': 49.99}
            ]
        }
    },
    'zh': {
        'meta': {
            'title': 'VipChat API 文档',
            'description': 'VipChat 消息平台的完整 API 参考',
            'version': '2.0.0',
            'base_url': 'https://api.vipchat.com',
        },
        'getting_started': {
            'title': '开始使用',
            'description': '了解如何进行身份验证和您的第一个 API 调用',
            'steps': [
                {'title': '创建 API 密钥', 'description': '注册并从仪表板创建您的第一个 API 密钥'},
                {'title': '选择您的套餐', 'description': '选择适合您需求的套餐'}
            ]
        },
        'authentication': {
            'title': '认证',
            'description': '所有 API 请求都需要通过 API 密钥进行身份验证'
        },
        'pricing': {
            'title': '定价和套餐',
            'description': '选择适合您需求的完美套餐',
            'plans': [
                {'id': 'free', 'name': '免费', 'price': 0},
                {'id': 'pro', 'name': '专业版', 'price': 9.99},
                {'id': 'enterprise', 'name': '企业版', 'price': 49.99}
            ]
        }
    }
}

# Version history
API_VERSIONS = [
    {'version': '2.0.0', 'released': '2024-01-15', 'changes': [
        'Added group call SFU support',
        'Enhanced E2EE for calls',
        'New webhook events',
        'Rate limiting per endpoint'
    ]},
    {'version': '1.5.0', 'released': '2023-10-01', 'changes': [
        'Added video calls',
        'Status updates API',
        'File upload improvements'
    ]},
    {'version': '1.0.0', 'released': '2023-01-01', 'changes': [
        'Initial release',
        'Core messaging',
        'Voice calls',
        'Contacts & groups'
    ]},
]


@docs_bp.route('', methods=['GET'])
def get_docs_index():
    """Get documentation index with available languages and versions"""
    languages = list(DOCS_CONTENT.keys())
    
    return jsonify({
        'success': True,
        'languages': [
            {'code': 'en', 'name': 'English'},
            {'code': 'es', 'name': 'Español'},
            {'code': 'ar', 'name': 'العربية'},
            {'code': 'zh', 'name': '中文'}
        ],
        'current_version': '2.0.0',
        'versions': API_VERSIONS,
        'base_url': 'https://api.vipchat.com',
        'docs_url': '/api/docs/en'
    })


@docs_bp.route('/<language>', methods=['GET'])
def get_docs(language):
    """Get documentation in specified language"""
    if language not in DOCS_CONTENT:
        language = 'en'
    
    return jsonify({
        'success': True,
        'language': language,
        'content': DOCS_CONTENT[language]
    })


@docs_bp.route('/<language>/<section>', methods=['GET'])
def get_docs_section(language, section):
    """Get specific documentation section"""
    if language not in DOCS_CONTENT:
        language = 'en'
    
    content = DOCS_CONTENT.get(language, DOCS_CONTENT['en'])
    
    # Navigate to specific section
    sections = section.split('.')
    result = content
    for s in sections:
        if s in result:
            result = result[s]
        else:
            return jsonify({'error': 'Section not found'}), 404
    
    return jsonify({
        'success': True,
        'language': language,
        'section': section,
        'content': result
    })


@docs_bp.route('/versions', methods=['GET'])
def get_versions():
    """Get API version history"""
    return jsonify({
        'success': True,
        'versions': API_VERSIONS,
        'current': '2.0.0'
    })


@docs_bp.route('/changelog', methods=['GET'])
def get_changelog():
    """Get detailed changelog"""
    return jsonify({
        'success': True,
        'changelog': API_VERSIONS,
        'additional_notes': {
            'deprecations': [
                {'endpoint': '/api/calls/legacy', 'deprecated_in': '1.5.0', 'removed_in': '2.0.0', 'replacement': '/api/calls/initiate'}
            ],
            'breaking_changes': [
                {'change': 'Response format changed for message list', 'version': '2.0.0'}
            ]
        }
    })


@docs_bp.route('/search', methods=['GET'])
def search_docs():
    """Search documentation"""
    query = request.args.get('q', '').lower()
    language = request.args.get('lang', 'en')
    
    if language not in DOCS_CONTENT:
        language = 'en'
    
    content = DOCS_CONTENT[language]
    results = []
    
    # Simple search in content
    def search_in_dict(d, path=''):
        for key, value in d.items():
            current_path = f"{path}.{key}" if path else key
            if isinstance(value, dict):
                search_in_dict(value, current_path)
            elif isinstance(value, list):
                for item in value:
                    if isinstance(item, dict):
                        search_in_dict(item, current_path)
            elif isinstance(value, str) and query in str(value).lower():
                results.append({
                    'section': current_path,
                    'match': str(value)[:100]
                })
    
    search_in_dict(content)
    
    return jsonify({
        'success': True,
        'query': query,
        'results': results[:20]
    })


@docs_bp.route('/code-examples', methods=['GET'])
def get_code_examples():
    """Get code examples in various languages"""
    category = request.args.get('category', 'authentication')
    language = request.args.get('language', 'javascript')
    
    examples = {
        'authentication': {
            'javascript': '''// Using fetch
const response = await fetch('https://api.vipchat.com/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your_api_key'
  },
  body: JSON.stringify({
    phone: '+1234567890',
    password: 'your_password'
  })
});
const { access_token } = await response.json();''',
            'python': '''import requests

response = requests.post(
    'https://api.vipchat.com/api/auth/login',
    headers={'X-API-Key': 'your_api_key'},
    json={
        'phone': '+1234567890',
        'password': 'your_password'
    }
)
data = response.json()
token = data['access_token']''',
            'bash': '''curl -X POST "https://api.vipchat.com/api/auth/login" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: your_api_key" \\
  -d '{"phone":"+1234567890","password":"your_password"}' '''
        },
        'send_message': {
            'javascript': '''const response = await fetch('https://api.vipchat.com/api/messages/123', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: JSON.stringify({
    receiver_id: '456',
    content: 'Hello!'
  })
});''',
            'python': '''import requests

response = requests.post(
    'https://api.vipchat.com/api/messages/123',
    headers={'Authorization': 'Bearer YOUR_TOKEN'},
    json={
        'receiver_id': '456',
        'content': 'Hello!'
    }
)'''
        },
        'make_call': {
            'javascript': '''// Initiate video call
const response = await fetch('https://api.vipchat.com/api/calls/initiate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: JSON.stringify({
    callee_id: '456',
    call_type: 'video'
  })
});
const { call_id, room_id, ice_servers } = await response.json();''',
            'python': '''import requests

response = requests.post(
    'https://api.vipchat.com/api/calls/initiate',
    headers={'Authorization': 'Bearer YOUR_TOKEN'},
    json={
        'callee_id': '456',
        'call_type': 'video'
    }
)
data = response.json()
print(f"Call ID: {data['call_id']}, Room: {data['room_id']}")'''
        },
        'upload_file': {
            'javascript': '''const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch('https://api.vipchat.com/api/upload/image', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: formData
});''',
            'python': '''import requests

with open('image.jpg', 'rb') as f:
    response = requests.post(
        'https://api.vipchat.com/api/upload/image',
        headers={'Authorization': 'Bearer YOUR_TOKEN'},
        files={'file': f}
    )'''
        }
    }
    
    return jsonify({
        'success': True,
        'category': category,
        'language': language,
        'example': examples.get(category, {}).get(language, 'No example available')
    })


@docs_bp.route('/rate-limits', methods=['GET'])
def get_rate_limits():
    """Get rate limit information"""
    return jsonify({
        'success': True,
        'rate_limits': {
            'sandbox': {
                'requests': 1000,
                'window': 'hour',
                'endpoints': ['/api/test/*']
            },
            'free': {
                'requests': 100,
                'window': 'hour',
                'endpoints': ['/api/*']
            },
            'pro': {
                'requests': 1000,
                'window': 'hour',
                'endpoints': ['/api/*']
            },
            'enterprise': {
                'requests': 10000,
                'window': 'hour',
                'endpoints': ['/api/*']
            }
        },
        'headers': {
            'X-RateLimit-Limit': 'Number of requests allowed',
            'X-RateLimit-Remaining': 'Number of requests remaining',
            'X-RateLimit-Reset': 'Unix timestamp when limit resets'
        }
    })


@docs_bp.route('/status', methods=['GET'])
def get_api_status():
    """Get API status and health information"""
    return jsonify({
        'success': True,
        'status': 'operational',
        'version': '2.0.0',
        'uptime': '99.99%',
        'latency': {
            'avg': '45ms',
            'p95': '120ms',
            'p99': '250ms'
        },
        'services': {
            'api': {'status': 'operational', 'latency': '32ms'},
            'websocket': {'status': 'operational', 'latency': '15ms'},
            'media': {'status': 'operational', 'latency': '65ms'},
            'storage': {'status': 'operational', 'latency': '28ms'}
        },
        'incidents': []
    })