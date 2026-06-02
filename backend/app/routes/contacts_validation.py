from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.models import db, User, Contact
import phonenumbers
from phonenumbers import geocoder, carrier, timezone, number_type
import requests

contacts_validation_bp = Blueprint('contacts_validation', __name__, url_prefix='/api/contacts')

@contacts_validation_bp.route('/validate-phone', methods=['POST'])
@jwt_required()
def validate_phone():
    """Validate phone number with international support"""
    try:
        data = request.json
        phone_number = data.get('phone_number')
        
        if not phone_number:
            return jsonify({'error': 'Phone number required'}), 400
        
        # Parse phone number
        try:
            parsed_number = phonenumbers.parse(phone_number, None)
        except phonenumbers.NumberParseException as e:
            return jsonify({
                'valid': False,
                'error': str(e)
            }), 400
        
        # Validate phone number
        is_valid = phonenumbers.is_valid_number(parsed_number)
        
        if not is_valid:
            return jsonify({
                'valid': False,
                'error': 'Invalid phone number'
            }), 400
        
        # Get phone number details
        country_code = parsed_number.country_code
        national_number = parsed_number.national_number
        country = geocoder.region_code_for_number(parsed_number)
        location = geocoder.description_for_number(parsed_number, 'en')
        carrier_name = carrier.name_for_number(parsed_number, 'en')
        timezones = timezone.time_zones_for_number(parsed_number)
        phone_type = number_type(parsed_number)
        
        # Format phone number
        international_format = phonenumbers.format_number(
            parsed_number, 
            phonenumbers.PhoneNumberFormat.INTERNATIONAL
        )
        e164_format = phonenumbers.format_number(
            parsed_number, 
            phonenumbers.PhoneNumberFormat.E164
        )
        national_format = phonenumbers.format_number(
            parsed_number, 
            phonenumbers.PhoneNumberFormat.NATIONAL
        )
        
        # Get phone type name
        type_names = {
            0: 'FIXED_LINE',
            1: 'MOBILE',
            2: 'FIXED_LINE_OR_MOBILE',
            3: 'TOLL_FREE',
            4: 'PREMIUM_RATE',
            5: 'SHARED_COST',
            6: 'VOIP',
            7: 'PERSONAL_NUMBER',
            8: 'PAGER',
            9: 'UAN',
            10: 'VOICEMAIL',
            -1: 'UNKNOWN'
        }
        type_name = type_names.get(phone_type, 'UNKNOWN')
        
        # Check if user exists with this phone number
        user = User.query.filter_by(phone_number=e164_format).first()
        
        # Get country information
        country_info = None
        try:
            country_response = requests.get(
                f'https://restcountries.com/v3.1/alpha/{country}',
                timeout=5
            )
            if country_response.status_code == 200:
                country_data = country_response.json()[0]
                country_info = {
                    'name': country_data.get('name', {}).get('common'),
                    'flag': country_data.get('flags', {}).get('svg'),
                    'capital': country_data.get('capital', [None])[0],
                    'region': country_data.get('region'),
                    'subregion': country_data.get('subregion'),
                    'population': country_data.get('population'),
                    'languages': list(country_data.get('languages', {}).values()),
                    'currencies': list(country_data.get('currencies', {}).keys()),
                    'timezones': country_data.get('timezones', [])
                }
        except Exception as e:
            print(f"Country info error: {e}")
        
        response_data = {
            'valid': True,
            'phone_number': {
                'international': international_format,
                'e164': e164_format,
                'national': national_format,
                'country_code': country_code,
                'national_number': str(national_number)
            },
            'location': {
                'country': country,
                'description': location,
                'timezones': list(timezones) if timezones else []
            },
            'carrier': carrier_name or 'Unknown',
            'type': type_name,
            'country_info': country_info,
            'exists': user is not None
        }
        
        if user:
            response_data['user'] = {
                'id': user.id,
                'full_name': user.full_name,
                'avatar_url': user.avatar_url,
                'bio': user.bio,
                'status': user.status
            }
        
        return jsonify(response_data), 200
    
    except Exception as e:
        return jsonify({
            'valid': False,
            'error': str(e)
        }), 500

@contacts_validation_bp.route('/search-by-country', methods=['GET'])
@jwt_required()
def search_by_country():
    """Search contacts by country"""
    try:
        country_code = request.args.get('country')
        
        if not country_code:
            return jsonify({'error': 'Country code required'}), 400
        
        # Get all users from this country
        users = User.query.filter(
            User.phone_number.like(f'+{country_code}%')
        ).limit(50).all()
        
        return jsonify({
            'users': [u.to_dict() for u in users],
            'count': len(users)
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@contacts_validation_bp.route('/countries', methods=['GET'])
@jwt_required()
def get_supported_countries():
    """Get list of supported countries"""
    try:
        # Get all supported regions
        supported_regions = phonenumbers.SUPPORTED_REGIONS
        
        countries = []
        for region in sorted(supported_regions):
            try:
                country_code = phonenumbers.country_code_for_region(region)
                example_number = phonenumbers.example_number(region)
                
                if example_number:
                    formatted = phonenumbers.format_number(
                        example_number,
                        phonenumbers.PhoneNumberFormat.INTERNATIONAL
                    )
                    
                    # Get country info
                    country_response = requests.get(
                        f'https://restcountries.com/v3.1/alpha/{region}',
                        timeout=2
                    )
                    
                    country_name = region
                    flag = None
                    
                    if country_response.status_code == 200:
                        country_data = country_response.json()[0]
                        country_name = country_data.get('name', {}).get('common', region)
                        flag = country_data.get('flags', {}).get('svg')
                    
                    countries.append({
                        'code': region,
                        'name': country_name,
                        'country_code': country_code,
                        'flag': flag,
                        'example': formatted
                    })
            except Exception:
                continue
        
        return jsonify({
            'countries': countries,
            'total': len(countries)
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@contacts_validation_bp.route('/lookup', methods=['POST'])
@jwt_required()
def lookup_contact():
    """Advanced contact lookup with multiple parameters"""
    try:
        data = request.json
        phone_number = data.get('phone_number')
        email = data.get('email')
        name = data.get('name')
        
        query = User.query
        
        if phone_number:
            query = query.filter(User.phone_number == phone_number)
        elif email:
            query = query.filter(User.email == email)
        elif name:
            query = query.filter(User.full_name.ilike(f'%{name}%'))
        else:
            return jsonify({'error': 'At least one search parameter required'}), 400
        
        users = query.limit(20).all()
        
        return jsonify({
            'users': [u.to_dict() for u in users],
            'count': len(users)
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@contacts_validation_bp.route('/search-users', methods=['GET'])
@jwt_required()
def search_users():
    """Search users by name, phone number, or email"""
    try:
        query = request.args.get('q', '').strip()
        
        if not query or len(query) < 2:
            return jsonify({'error': 'Query must be at least 2 characters'}), 400
        
        current_user_id = get_jwt_identity()
        
        users = User.query.filter(
            User.id != current_user_id,
            db.or_(
                User.full_name.ilike(f'%{query}%'),
                User.phone_number.ilike(f'%{query}%'),
                User.email.ilike(f'%{query}%'),
            )
        ).limit(30).all()
        
        return jsonify({
            'users': [u.to_dict() for u in users],
            'count': len(users)
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@contacts_validation_bp.route('/bulk-validate', methods=['POST'])
@jwt_required()
def bulk_validate():
    """Validate multiple phone numbers at once"""
    try:
        data = request.json
        phone_numbers = data.get('phone_numbers', [])
        
        if not phone_numbers or len(phone_numbers) > 100:
            return jsonify({'error': 'Provide 1-100 phone numbers'}), 400
        
        results = []
        
        for phone in phone_numbers:
            try:
                parsed = phonenumbers.parse(phone, None)
                is_valid = phonenumbers.is_valid_number(parsed)
                
                e164 = phonenumbers.format_number(
                    parsed,
                    phonenumbers.PhoneNumberFormat.E164
                )
                
                user = User.query.filter_by(phone_number=e164).first()
                
                results.append({
                    'phone': phone,
                    'valid': is_valid,
                    'e164': e164 if is_valid else None,
                    'exists': user is not None,
                    'user': user.to_dict() if user else None
                })
            except Exception as e:
                results.append({
                    'phone': phone,
                    'valid': False,
                    'error': str(e)
                })
        
        return jsonify({
            'results': results,
            'total': len(results),
            'valid_count': sum(1 for r in results if r.get('valid')),
            'exists_count': sum(1 for r in results if r.get('exists'))
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500
