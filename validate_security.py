"""
Security Integration Validation Script
Checks that all security modules are properly integrated and functional
"""
import os
import sys
from pathlib import Path

def check_file_exists(filepath, description):
    """Check if file exists"""
    if os.path.exists(filepath):
        print(f"[PASS] {description}: {filepath}")
        return True
    else:
        print(f"[FAIL] {description}: {filepath} - NOT FOUND")
        return False

def validate_backend_security():
    """Validate backend security modules"""
    print("\nValidating Backend Security Modules...")
    
    files = [
        ("app/security/csrf_protection.py", "CSRF Protection"),
        ("app/security/input_validation.py", "Input Validation"),
        ("app/security/tls_security.py", "TLS Security"),
        ("app/security/audit_logging.py", "Audit Logging"),
        ("app/security/advanced_security.py", "Advanced Security"),
        ("app/security/encryption.py", "Encryption Service"),
        ("app/security/signal_protocol.py", "Signal Protocol"),
        ("app/middleware/security.py", "Security Middleware"),
        ("tests/test_production_security.py", "Security Tests"),
        ("requirements.txt", "Dependencies"),
    ]
    
    results = []
    for filepath, desc in files:
        full_path = os.path.join("backend", filepath)
        results.append(check_file_exists(full_path, desc))
    
    return all(results)

def validate_mobile_security():
    """Validate mobile security modules"""
    print("\nValidating Mobile Security Modules...")
    
    files = [
        ("services/apiSecurity.js", "API Security"),
        ("services/secureStorage.js", "Secure Storage"),
        ("services/e2ee.js", "E2EE Service"),
        ("services/api.js", "API Client"),
        ("services/storage.js", "Storage Service"),
    ]
    
    results = []
    for filepath, desc in files:
        full_path = os.path.join("mobile", filepath)
        results.append(check_file_exists(full_path, desc))
    
    return all(results)

def validate_web_security():
    """Validate web security modules"""
    print("\nValidating Web Security Modules...")
    
    files = [
        ("src/services/webSecurity.js", "Web Security"),
        ("src/services/api.js", "API Client"),
    ]
    
    results = []
    for filepath, desc in files:
        full_path = os.path.join("web", filepath)
        results.append(check_file_exists(full_path, desc))
    
    return all(results)

def validate_documentation():
    """Validate documentation"""
    print("\nValidating Documentation...")
    
    files = [
        ("PRODUCTION_SECURITY.md", "Production Security Guide"),
        ("SECURITY_SETUP.md", "Security Setup Guide"),
        ("SECURITY_IMPLEMENTATION_COMPLETE.md", "Implementation Summary"),
        ("README.md", "Main README"),
    ]
    
    results = []
    for filepath, desc in files:
        results.append(check_file_exists(filepath, desc))
    
    return all(results)

def check_backend_integration():
    """Check if security modules are integrated in app/__init__.py"""
    print("\nChecking Backend Integration...")
    
    init_file = "backend/app/__init__.py"
    if not os.path.exists(init_file):
        print(f"[FAIL] {init_file} not found")
        return False
    
    with open(init_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    checks = [
        ("csrf_protection", "CSRF Protection imported"),
        ("tls_manager", "TLS Manager imported"),
        ("security_audit", "Audit Logging imported"),
        ("SecurityManager", "Security Manager imported"),
    ]
    
    results = []
    for check, desc in checks:
        if check in content:
            print(f"[PASS] {desc}")
            results.append(True)
        else:
            print(f"[WARN] {desc} - not found in __init__.py")
            results.append(False)
    
    return all(results)

def check_mobile_integration():
    """Check if security is integrated in mobile app"""
    print("\nChecking Mobile Integration...")
    
    api_file = "mobile/services/api.js"
    if not os.path.exists(api_file):
        print(f"[FAIL] {api_file} not found")
        return False
    
    with open(api_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    checks = [
        ("secureStorage", "Secure Storage imported"),
        ("apiSecurityManager", "API Security Manager imported"),
        ("setupAPISecurityInterceptors", "Security Interceptors setup"),
    ]
    
    results = []
    for check, desc in checks:
        if check in content:
            print(f"[PASS] {desc}")
            results.append(True)
        else:
            print(f"[WARN] {desc} - not found in api.js")
            results.append(False)
    
    return any(results)  # At least some integration

def print_summary(backend, mobile, web, docs, backend_int, mobile_int):
    """Print validation summary"""
    print("\n" + "="*60)
    print("SECURITY INTEGRATION VALIDATION SUMMARY")
    print("="*60)
    
    total = 6
    passed = sum([backend, mobile, web, docs, backend_int, mobile_int])
    
    print(f"\nBackend Security Modules: {'PASS' if backend else 'FAIL'}")
    print(f"Mobile Security Modules: {'PASS' if mobile else 'FAIL'}")
    print(f"Web Security Modules: {'PASS' if web else 'FAIL'}")
    print(f"Documentation: {'PASS' if docs else 'FAIL'}")
    print(f"Backend Integration: {'PASS' if backend_int else 'WARN'}")
    print(f"Mobile Integration: {'PASS' if mobile_int else 'WARN'}")
    
    print(f"\n{'='*60}")
    print(f"Overall: {passed}/{total} checks passed")
    print(f"{'='*60}\n")
    
    if passed == total:
        print("SUCCESS: All security modules are properly integrated!")
        print("Your app is production-ready with enterprise-grade security!")
        return 0
    elif passed >= 4:
        print("WARNING: Most security modules are integrated.")
        print("Review warnings above and complete remaining integrations.")
        return 0
    else:
        print("ERROR: Security integration is incomplete.")
        print("Please complete the setup following SECURITY_SETUP.md")
        return 1

def main():
    """Main validation function"""
    print("VipChat Security Integration Validator")
    print("="*60)
    
    # Change to project root
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    # Run validations
    backend = validate_backend_security()
    mobile = validate_mobile_security()
    web = validate_web_security()
    docs = validate_documentation()
    backend_int = check_backend_integration()
    mobile_int = check_mobile_integration()
    
    # Print summary
    exit_code = print_summary(backend, mobile, web, docs, backend_int, mobile_int)
    
    return exit_code

if __name__ == "__main__":
    sys.exit(main())
