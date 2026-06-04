"""
Advanced Data Compression Service
- Image: WebP/AVIF with quality adjustment
- Video: H.264 with resolution scaling
- Audio: Opus codec
- Text: Brotli compression
"""

import io
import os
import subprocess
import hashlib
import time
from typing import Tuple, Optional
from flask import current_app

class MediaCompressor:
    """Intelligent media compression for minimal bandwidth"""
    
    # Quality settings based on network condition
    QUALITY_PROFILES = {
        'low': {'image_quality': 40, 'video_bitrate': '250k', 'audio_bitrate': '24k'},
        'medium': {'image_quality': 60, 'video_bitrate': '500k', 'audio_bitrate': '48k'},
        'high': {'image_quality': 80, 'video_bitrate': '1M', 'audio_bitrate': '96k'},
        'original': {'image_quality': 95, 'video_bitrate': '2M', 'audio_bitrate': '128k'},
    }
    
    @staticmethod
    async def compress_image(
        image_data: bytes,
        quality: int = 75,
        max_width: int = 1920,
        max_height: int = 1920,
        format: str = 'WEBP'
    ) -> Tuple[bytes, dict]:
        """
        Compress image with WebP/AVIF format
        Returns (compressed_data, metadata)
        """
        try:
            from PIL import Image
            
            img = Image.open(io.BytesIO(image_data))
            original_size = len(image_data)
            
            # Auto-orient based on EXIF
            try:
                from PIL import ImageOps
                img = ImageOps.exif_transpose(img)
            except:
                pass
            
            # Resize if needed
            if max(img.size) > max_width:
                ratio = max_width / max(img.size)
                new_size = (int(img.width * ratio), int(img.height * ratio))
                img = img.resize(new_size, Image.Resampling.LANCZOS)
            
            # Convert to RGB if necessary
            if img.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                img = background
            
            # Compress
            output = io.BytesIO()
            
            if format.upper() == 'AVIF':
                try:
                    img.save(output, format='AVIF', quality=quality)
                except:
                    img.save(output, format='WEBP', quality=quality, method=6)
            else:
                img.save(output, format='WEBP', quality=quality, method=6)
            
            compressed = output.getvalue()
            compressed_size = len(compressed)
            
            # Calculate savings
            savings_percent = round((1 - compressed_size / original_size) * 100, 2) if original_size > 0 else 0
            
            metadata = {
                'original_size': original_size,
                'compressed_size': compressed_size,
                'savings_percent': savings_percent,
                'format': format,
                'dimensions': img.size,
                'quality': quality,
            }
            
            return compressed, metadata
            
        except Exception as e:
            current_app.logger.error(f"Image compression failed: {e}")
            return image_data, {'error': str(e), 'compressed': False}
    
    @staticmethod
    async def compress_video(
        video_data: bytes,
        quality_profile: str = 'medium',
        max_resolution: int = 720
    ) -> Tuple[bytes, dict]:
        """
        Compress video with H.264 codec
        Requires ffmpeg
        """
        profile = MediaCompressor.QUALITY_PROFILES.get(quality_profile, MediaCompressor.QUALITY_PROFILES['medium'])
        
        try:
            # Use ffmpeg for video compression
            # This is a simplified implementation - production would use streaming
            
            input_file = f"/tmp/video_input_{time.time()}.mp4"
            output_file = f"/tmp/video_output_{time.time()}.mp4"
            
            # Write input
            with open(input_file, 'wb') as f:
                f.write(video_data)
            
            original_size = len(video_data)
            
            # FFmpeg command
            cmd = [
                'ffmpeg', '-y', '-i', input_file,
                '-c:v', 'libx264',
                '-b:v', profile['video_bitrate'],
                '-preset', 'fast',
                '-vf', f'scale=-2:{max_resolution}',
                '-c:a', 'aac',
                '-b:a', profile['audio_bitrate'],
                '-movflags', '+faststart',
                output_file
            ]
            
            result = subprocess.run(cmd, capture_output=True, timeout=300)
            
            if result.returncode == 0:
                with open(output_file, 'rb') as f:
                    compressed = f.read()
                
                compressed_size = len(compressed)
                savings_percent = round((1 - compressed_size / original_size) * 100, 2) if original_size > 0 else 0
                
                # Cleanup
                os.remove(input_file)
                os.remove(output_file)
                
                return compressed, {
                    'original_size': original_size,
                    'compressed_size': compressed_size,
                    'savings_percent': savings_percent,
                    'codec': 'H.264',
                    'profile': quality_profile,
                }
            else:
                os.remove(input_file)
                return video_data, {'error': 'FFmpeg failed', 'compressed': False}
                
        except Exception as e:
            current_app.logger.error(f"Video compression failed: {e}")
            return video_data, {'error': str(e), 'compressed': False}
    
    @staticmethod
    async def compress_audio(
        audio_data: bytes,
        quality_profile: str = 'medium',
        format: str = 'opus'
    ) -> Tuple[bytes, dict]:
        """
        Compress audio with Opus codec
        Best for voice messages
        """
        profile = MediaCompressor.QUALITY_PROFILES.get(quality_profile, MediaCompressor.QUALITY_PROFILES['medium'])
        
        try:
            input_file = f"/tmp/audio_input_{time.time()}.m4a"
            output_file = f"/tmp/audio_output_{time.time()}.ogg"
            
            with open(input_file, 'wb') as f:
                f.write(audio_data)
            
            original_size = len(audio_data)
            
            # FFmpeg command for Opus
            cmd = [
                'ffmpeg', '-y', '-i', input_file,
                '-c:a', 'libopus',
                '-b:a', profile['audio_bitrate'],
                '-vbr', 'on',
                '-compression_level', '10',
                output_file
            ]
            
            result = subprocess.run(cmd, capture_output=True, timeout=60)
            
            if result.returncode == 0:
                with open(output_file, 'rb') as f:
                    compressed = f.read()
                
                compressed_size = len(compressed)
                savings_percent = round((1 - compressed_size / original_size) * 100, 2) if original_size > 0 else 0
                
                os.remove(input_file)
                os.remove(output_file)
                
                return compressed, {
                    'original_size': original_size,
                    'compressed_size': compressed_size,
                    'savings_percent': savings_percent,
                    'codec': 'Opus',
                    'bitrate': profile['audio_bitrate'],
                }
            else:
                os.remove(input_file)
                return audio_data, {'error': 'FFmpeg failed', 'compressed': False}
                
        except Exception as e:
            return audio_data, {'error': str(e), 'compressed': False}


class TextCompressor:
    """Text compression using Brotli"""
    
    @staticmethod
    def compress(text: str, quality: int = 6) -> bytes:
        """Compress text with Brotli"""
        import brotli
        
        if isinstance(text, str):
            text = text.encode('utf-8')
        
        return brotli.compress(text, quality=quality)
    
    @staticmethod
    def decompress(data: bytes) -> str:
        """Decompress Brotli data"""
        import brotli
        
        return brotli.decompress(data).decode('utf-8')


class NetworkAwareCompression:
    """Adjust compression based on network conditions"""
    
    @staticmethod
    def get_quality_profile(network_type: str, signal_strength: int = 100) -> str:
        """Get quality profile based on network condition"""
        if network_type == 'wifi':
            return 'high' if signal_strength > 50 else 'medium'
        elif network_type == 'cellular':
            if signal_strength > 70:
                return 'medium'
            elif signal_strength > 30:
                return 'low'
            else:
                return 'low'
        elif network_type == 'offline':
            return 'low'  # Prepare for later sync
        else:
            return 'medium'
    
    @staticmethod
    async def compress_with_network_awareness(
        data: bytes,
        media_type: str,
        network_type: str = 'wifi',
        signal_strength: int = 100
    ) -> Tuple[bytes, dict]:
        """Compress based on network conditions"""
        
        profile = NetworkAwareCompression.get_quality_profile(network_type, signal_strength)
        
        if media_type == 'image':
            quality = MediaCompressor.QUALITY_PROFILES[profile]['image_quality']
            return await MediaCompressor.compress_image(data, quality)
        elif media_type == 'video':
            return await MediaCompressor.compress_video(data, profile)
        elif media_type == 'audio':
            return await MediaCompressor.compress_audio(data, profile)
        else:
            return data, {'compressed': False}


# Export
media_compressor = MediaCompressor()
