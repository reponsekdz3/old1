"""
Advanced Media Processing Service
Handles transcoding, thumbnail generation, and multi-resolution processing
"""
import os
import logging
import subprocess
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from datetime import datetime
import hashlib
from PIL import Image, ImageOps
import io
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor
import threading

logger = logging.getLogger(__name__)

@dataclass
class MediaVersion:
    """Represents a processed version of media"""
    version_id: str
    resolution: str
    format: str
    size_bytes: int
    url: str
    width: int
    height: int
    bitrate: Optional[int] = None
    duration: Optional[float] = None

@dataclass
class ProcessingResult:
    """Result of media processing"""
    success: bool
    original_url: str
    versions: List[MediaVersion]
    thumbnail_url: Optional[str] = None
    preview_url: Optional[str] = None
    metadata: Optional[Dict] = None
    error: Optional[str] = None

class MediaProcessor:
    """Production-grade media processing with transcoding pipeline"""
    
    # Resolution presets for images
    IMAGE_PRESETS = {
        'thumbnail': {'max_width': 150, 'max_height': 150, 'quality': 75},
        'preview': {'max_width': 400, 'max_height': 400, 'quality': 85},
        'low': {'max_width': 640, 'max_height': 480, 'quality': 80},
        'medium': {'max_width': 1280, 'max_height': 720, 'quality': 85},
        'high': {'max_width': 1920, 'max_height': 1080, 'quality': 90},
        'original': {'max_width': None, 'max_height': None, 'quality': 95}
    }
    
    # Resolution presets for videos
    VIDEO_PRESETS = {
        'thumbnail': {'width': 150, 'height': 150, 'bitrate': '100k', 'fps': 1},
        'preview': {'width': 320, 'height': 240, 'bitrate': '500k', 'fps': 15},
        'low': {'width': 640, 'height': 360, 'bitrate': '800k', 'fps': 24},
        'medium': {'width': 1280, 'height': 720, 'bitrate': '2500k', 'fps': 30},
        'high': {'width': 1920, 'height': 1080, 'bitrate': '5000k', 'fps': 30}
    }
    
    def __init__(self, upload_dir: str, cdn_base_url: str = None, max_workers: int = 4):
        self.upload_dir = Path(upload_dir)
        self.cdn_base_url = cdn_base_url or ''
        self.max_workers = max_workers
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self._processing_lock = threading.Lock()
        self._active_jobs: Dict[str, bool] = {}
        
        # Ensure directories exist
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        (self.upload_dir / 'thumbnails').mkdir(exist_ok=True)
        (self.upload_dir / 'previews').mkdir(exist_ok=True)
        (self.upload_dir / 'videos').mkdir(exist_ok=True)
        (self.upload_dir / 'images').mkdir(exist_ok=True)
        
        # Check FFmpeg availability
        self.ffmpeg_available = self._check_ffmpeg()
        if not self.ffmpeg_available:
            logger.warning("[MEDIA_PROC] FFmpeg not available - video processing will be limited")
    
    def _check_ffmpeg(self) -> bool:
        """Check if FFmpeg is available"""
        try:
            subprocess.run(['ffmpeg', '-version'], capture_output=True, timeout=5)
            return True
        except (subprocess.SubprocessError, FileNotFoundError):
            return False
    
    def _generate_version_id(self, file_path: str, version: str) -> str:
        """Generate unique version ID based on content hash"""
        hasher = hashlib.md5()
        hasher.update(f"{file_path}_{version}_{datetime.utcnow().timestamp()}".encode())
        return hasher.hexdigest()[:12]
    
    def _get_output_path(self, original_path: str, version: str, extension: str) -> Path:
        """Get output path for processed version"""
        filename = Path(original_path).stem
        return self.upload_dir / 'processed' / f"{filename}_{version}.{extension}"
    
    def process_image(self, file_path: str, generate_versions: List[str] = None) -> ProcessingResult:
        """
        Process image with multiple resolutions and thumbnails
        
        Args:
            file_path: Path to original image
            generate_versions: List of versions to generate (default: thumbnail, preview, medium)
        
        Returns:
            ProcessingResult with all generated versions
        """
        if generate_versions is None:
            generate_versions = ['thumbnail', 'preview', 'medium']
        
        try:
            # Load image
            with Image.open(file_path) as img:
                # Auto-orient based on EXIF
                img = ImageOps.exif_transpose(img)
                
                original_width, original_height = img.size
                original_format = img.format or 'JPEG'
                
                versions = []
                
                for version_name in generate_versions:
                    if version_name not in self.IMAGE_PRESETS:
                        continue
                    
                    preset = self.IMAGE_PRESETS[version_name]
                    
                    # Skip original - just use the file as-is
                    if version_name == 'original':
                        versions.append(MediaVersion(
                            version_id=self._generate_version_id(file_path, version_name),
                            resolution='original',
                            format=original_format.lower(),
                            size_bytes=os.path.getsize(file_path),
                            url=f"{self.cdn_base_url}/{file_path}",
                            width=original_width,
                            height=original_height
                        ))
                        continue
                    
                    # Calculate target dimensions
                    max_w = preset['max_width']
                    max_h = preset['max_height']
                    
                    if max_w and max_h:
                        ratio = min(max_w / original_width, max_h / original_height)
                        target_width = int(original_width * ratio)
                        target_height = int(original_height * ratio)
                    else:
                        target_width, target_height = original_width, original_height
                    
                    # Resize image
                    resized = img.resize((target_width, target_height), Image.Resampling.LANCZOS)
                    
                    # Generate output path
                    output_dir = self.upload_dir / 'thumbnails' if version_name == 'thumbnail' else self.upload_dir / 'previews'
                    output_dir.mkdir(exist_ok=True)
                    
                    output_format = 'JPEG' if version_name in ['thumbnail', 'preview'] else original_format
                    output_ext = 'jpg' if output_format == 'JPEG' else original_format.lower()
                    
                    output_path = output_dir / f"{Path(file_path).stem}_{version_name}.{output_ext}"
                    
                    # Save with optimization
                    save_kwargs = {'quality': preset['quality'], 'optimize': True}
                    if output_format == 'JPEG':
                        save_kwargs['progressive'] = True
                    
                    resized.save(output_path, format=output_format, **save_kwargs)
                    
                    versions.append(MediaVersion(
                        version_id=self._generate_version_id(file_path, version_name),
                        resolution=version_name,
                        format=output_ext,
                        size_bytes=output_path.stat().st_size,
                        url=f"{self.cdn_base_url}/thumbnails/{output_path.name}" if version_name == 'thumbnail' else f"{self.cdn_base_url}/previews/{output_path.name}",
                        width=target_width,
                        height=target_height
                    ))
                    
                    logger.debug(f"[MEDIA_PROC] Generated {version_name} version: {target_width}x{target_height}")
                
                # Generate thumbnail URL
                thumbnail_url = next((v.url for v in versions if v.resolution == 'thumbnail'), None)
                preview_url = next((v.url for v in versions if v.resolution == 'preview'), None)
                
                return ProcessingResult(
                    success=True,
                    original_url=f"{self.cdn_base_url}/{file_path}",
                    versions=versions,
                    thumbnail_url=thumbnail_url,
                    preview_url=preview_url,
                    metadata={
                        'original_width': original_width,
                        'original_height': original_height,
                        'format': original_format,
                        'mode': img.mode
                    }
                )
        
        except Exception as e:
            logger.error(f"[MEDIA_PROC] Image processing failed: {e}")
            return ProcessingResult(
                success=False,
                original_url=file_path,
                versions=[],
                error=str(e)
            )
    
    def process_video(self, file_path: str, generate_versions: List[str] = None) -> ProcessingResult:
        """
        Process video with transcoding and thumbnail extraction
        
        Args:
            file_path: Path to original video
            generate_versions: List of versions to generate (default: thumbnail, preview, medium)
        
        Returns:
            ProcessingResult with all generated versions
        """
        if generate_versions is None:
            generate_versions = ['thumbnail', 'preview', 'medium']
        
        if not self.ffmpeg_available:
            logger.warning("[MEDIA_PROC] FFmpeg not available, skipping video processing")
            return ProcessingResult(
                success=True,
                original_url=f"{self.cdn_base_url}/{file_path}",
                versions=[],
                error="FFmpeg not available"
            )
        
        try:
            versions = []
            
            # Get video metadata
            probe_cmd = [
                'ffprobe', '-v', 'quiet', '-print_format', 'json',
                '-show_format', '-show_streams', file_path
            ]
            result = subprocess.run(probe_cmd, capture_output=True, text=True, timeout=30)
            
            import json
            metadata = json.loads(result.stdout) if result.returncode == 0 else {}
            
            video_stream = next((s for s in metadata.get('streams', []) if s['codec_type'] == 'video'), {})
            original_width = int(video_stream.get('width', 0))
            original_height = int(video_stream.get('height', 0))
            duration = float(metadata.get('format', {}).get('duration', 0))
            
            for version_name in generate_versions:
                if version_name not in self.VIDEO_PRESETS:
                    continue
                
                preset = self.VIDEO_PRESETS[version_name]
                
                # Generate thumbnail from frame
                if version_name == 'thumbnail':
                    output_dir = self.upload_dir / 'thumbnails'
                    output_dir.mkdir(exist_ok=True)
                    output_path = output_dir / f"{Path(file_path).stem}_thumb.jpg"
                    
                    # Extract frame at 1 second or 10% of duration
                    timestamp = min(1.0, duration * 0.1) if duration > 0 else 0
                    
                    cmd = [
                        'ffmpeg', '-y', '-ss', str(timestamp),
                        '-i', file_path,
                        '-vframes', '1',
                        '-vf', f'scale={preset["width"]}:{preset["height"]}:force_original_aspect_ratio=decrease',
                        '-q:v', '5',
                        str(output_path)
                    ]
                    
                    subprocess.run(cmd, capture_output=True, timeout=60)
                    
                    if output_path.exists():
                        versions.append(MediaVersion(
                            version_id=self._generate_version_id(file_path, version_name),
                            resolution='thumbnail',
                            format='jpg',
                            size_bytes=output_path.stat().st_size,
                            url=f"{self.cdn_base_url}/thumbnails/{output_path.name}",
                            width=preset['width'],
                            height=preset['height']
                        ))
                
                # Transcode video versions
                else:
                    output_dir = self.upload_dir / 'videos'
                    output_dir.mkdir(exist_ok=True)
                    output_path = output_dir / f"{Path(file_path).stem}_{version_name}.mp4"
                    
                    cmd = [
                        'ffmpeg', '-y', '-i', file_path,
                        '-c:v', 'libx264', '-preset', 'fast',
                        '-b:v', preset['bitrate'],
                        '-vf', f'scale={preset["width"]}:{preset["height"]}',
                        '-r', str(preset['fps']),
                        '-c:a', 'aac', '-b:a', '128k',
                        '-movflags', '+faststart',
                        str(output_path)
                    ]
                    
                    subprocess.run(cmd, capture_output=True, timeout=300)
                    
                    if output_path.exists():
                        versions.append(MediaVersion(
                            version_id=self._generate_version_id(file_path, version_name),
                            resolution=version_name,
                            format='mp4',
                            size_bytes=output_path.stat().st_size,
                            url=f"{self.cdn_base_url}/videos/{output_path.name}",
                            width=preset['width'],
                            height=preset['height'],
                            bitrate=int(preset['bitrate'].replace('k', '000')),
                            duration=duration
                        ))
            
            thumbnail_url = next((v.url for v in versions if v.resolution == 'thumbnail'), None)
            
            return ProcessingResult(
                success=True,
                original_url=f"{self.cdn_base_url}/{file_path}",
                versions=versions,
                thumbnail_url=thumbnail_url,
                metadata={
                    'original_width': original_width,
                    'original_height': original_height,
                    'duration': duration,
                    'format': metadata.get('format', {}).get('format_name', 'unknown')
                }
            )
        
        except Exception as e:
            logger.error(f"[MEDIA_PROC] Video processing failed: {e}")
            return ProcessingResult(
                success=False,
                original_url=file_path,
                versions=[],
                error=str(e)
            )
    
    def process_upload(self, file_path: str, media_type: str) -> ProcessingResult:
        """
        Process uploaded media file based on type
        
        Args:
            file_path: Path to uploaded file
            media_type: 'image', 'video', 'audio', 'document'
        
        Returns:
            ProcessingResult with processed versions
        """
        if media_type == 'image':
            return self.process_image(file_path)
        elif media_type == 'video':
            return self.process_video(file_path)
        elif media_type == 'audio':
            # Audio processing - just return original for now
            return ProcessingResult(
                success=True,
                original_url=f"{self.cdn_base_url}/{file_path}",
                versions=[],
                metadata={'type': 'audio'}
            )
        else:
            # Documents - no processing
            return ProcessingResult(
                success=True,
                original_url=f"{self.cdn_base_url}/{file_path}",
                versions=[]
            )
    
    def process_async(self, file_path: str, media_type: str, callback=None):
        """
        Process media asynchronously in background thread
        
        Args:
            file_path: Path to uploaded file
            media_type: Type of media
            callback: Optional callback function(result)
        
        Returns:
            Job ID for tracking
        """
        job_id = self._generate_version_id(file_path, 'job')
        
        def _process():
            with self._processing_lock:
                self._active_jobs[job_id] = True
            
            try:
                result = self.process_upload(file_path, media_type)
                if callback:
                    callback(result)
            finally:
                with self._processing_lock:
                    self._active_jobs.pop(job_id, None)
        
        self.executor.submit(_process)
        return job_id
    
    def get_active_jobs_count(self) -> int:
        """Get number of active processing jobs"""
        with self._processing_lock:
            return len(self._active_jobs)
    
    def shutdown(self):
        """Shutdown the executor"""
        self.executor.shutdown(wait=True)


# Global instance
media_processor = None

def init_media_processor(upload_dir: str, cdn_base_url: str = None):
    """Initialize global media processor"""
    global media_processor
    media_processor = MediaProcessor(upload_dir, cdn_base_url)
    logger.info(f"[MEDIA_PROC] Initialized media processor (upload_dir: {upload_dir})")
    return media_processor
