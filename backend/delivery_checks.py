"""Inspect uploaded bytes, never a filename or client supplied dimensions."""
import hashlib
import io
import struct
from PIL import Image, UnidentifiedImageError
from fastapi import HTTPException
from matching import ratios

MAX_BYTES = 50 * 1024 * 1024


def boxes(data, start=0, end=None):
    end = len(data) if end is None else end
    while start + 8 <= end:
        size, kind = struct.unpack_from('>I4s', data, start)
        header = 8
        if size == 1:
            if start + 16 > end:
                break
            size, header = struct.unpack_from('>Q', data, start + 8)[0], 16
        if size == 0:
            size = end - start
        if size < header or start + size > end:
            break
        yield kind, start + header, start + size
        start += size


def inspect_bytes(data):
    if not data or len(data) > MAX_BYTES:
        raise HTTPException(422, 'Upload an image or MP4 between 1 byte and 50 MB.')
    try:
        with Image.open(io.BytesIO(data)) as image:
            if image.format not in ('PNG', 'JPEG', 'WEBP'):
                raise HTTPException(422, 'Use PNG, JPEG, WebP or MP4.')
            width, height = image.size
            mime = Image.MIME[image.format]
            image.verify()
            return {'width': width, 'height': height, 'duration_seconds': None, 'media_type': 'image', 'mime': mime, 'sha256': hashlib.sha256(data).hexdigest()}
    except (UnidentifiedImageError, OSError, SyntaxError, Image.DecompressionBombError):
        pass
    try:
        top = list(boxes(data))
        if not any(k == b'ftyp' for k, _, _ in top) or not any(k == b'mdat' for k, _, _ in top):
            raise ValueError('Not MP4')
        for kind, start, end in top:
            if kind != b'moov':
                continue
            for kind, start, end in boxes(data, start, end):
                if kind != b'trak':
                    continue
                width = height = 0
                duration = None
                video = False
                for kind, a, b in boxes(data, start, end):
                    if kind == b'tkhd' and b - a >= 84:
                        width, height = (round(x / 65536) for x in struct.unpack_from('>II', data, b - 8))
                        matrix = struct.unpack_from('>9i', data, b - 44)
                        if matrix[0] == 0 and abs(matrix[1]) == 65536:
                            width, height = height, width
                    if kind == b'mdia':
                        for child, c, d in boxes(data, a, b):
                            if child == b'hdlr' and d - c >= 12:
                                video = data[c + 8:c + 12] == b'vide'
                            if child == b'mdhd' and d - c >= 24:
                                version = data[c]
                                offset = c + (20 if version == 1 else 12)
                                scale = struct.unpack_from('>I', data, offset)[0]
                                ticks = struct.unpack_from('>Q' if version == 1 else '>I', data, offset + 4)[0]
                                duration = ticks / scale if scale else None
                if video and width > 0 and height > 0 and duration and duration < 86400:
                    return {'width': width, 'height': height, 'duration_seconds': round(duration, 3), 'media_type': 'video', 'mime': 'video/mp4', 'sha256': hashlib.sha256(data).hexdigest()}
    except (ValueError, struct.error, IndexError):
        pass
    raise HTTPException(422, 'Could not inspect this file. Use a valid PNG, JPEG, WebP or MP4 video with readable dimensions and duration.')


def check_delivery(metadata, brief):
    checks = []
    format_text = (brief.get('format') or '').lower()
    formats = {'mp4': 'video/mp4', 'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'webp': 'image/webp'}
    requested = {mime for key, mime in formats.items() if key in format_text}
    if requested:
        checks.append({'name': 'File format', 'passed': metadata['mime'] in requested,
                       'detail': f"Uploaded {metadata['mime']}; required {brief['format']}.", 'fix': 'Export in the file format specified in the brief.'})
    wanted = ratios(brief.get('format'))
    if wanted:
        actual = metadata['width'] / metadata['height']
        ok = any(abs(actual - int(r.split(':')[0]) / int(r.split(':')[1])) <= .015 for r in wanted if int(r.split(':')[1]))
        checks.append({'name': 'Aspect ratio', 'passed': ok, 'detail': f"{metadata['width']} × {metadata['height']} px; required {' or '.join(wanted)}.", 'fix': 'Export again in the required aspect ratio.'})
    target = brief.get('duration_seconds')
    if target:
        duration = metadata.get('duration_seconds')
        ok = duration is not None and abs(duration - target) <= .5
        checks.append({'name': 'Duration', 'passed': ok, 'detail': f"{duration if duration is not None else 'No video duration'} seconds; required {target} seconds (±0.5s).", 'fix': 'Trim or extend the video to the brief’s duration.'})
    content = (brief.get('content_type') or '').casefold()
    expected = 'video' if any(x in content for x in ('video', 'film', 'animation', 'motion')) else 'image' if any(x in content for x in ('image', 'photo', 'still')) else None
    if expected:
        checks.append({'name': 'Content type', 'passed': metadata['media_type'] == expected, 'detail': f"Uploaded {metadata['media_type']}; required {expected}.", 'fix': 'Upload the requested content type.'})
    return {'passed': all(c['passed'] for c in checks), 'checks': checks, 'source': 'server inspected uploaded bytes', 'metadata': metadata}


def requires_checked_file(brief):
    content = (brief.get('content_type') or '').lower()
    format = (brief.get('format') or '').lower()
    if any(x in content for x in ('video', 'film', 'animation', 'motion', 'image', 'photo', 'still')):
        return True
    if any(x in format for x in ('mp4', 'png', 'jpg', 'jpeg', 'webp')):
        return True
    if any(x in content for x in ('audio', 'music', 'voice', 'copy', 'writing', 'document', 'text', '3d model')):
        return False
    return bool(ratios(format) or brief.get('duration_seconds'))
