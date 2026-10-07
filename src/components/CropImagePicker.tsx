'use client';

import { useEffect, useRef, useState } from 'react';
import { cropRectangle } from '../lib/uploads/cropGeometry';
import { ImageUploadButton } from './ImageUploadButton';
import { loadCropImage } from '../lib/uploads/loadCropImage';

export function CropImagePicker({ id, label, value, onChange, aspect = 1, disabled = false, onEditingChange }: {
  id: string; label: string; value: File | null; onChange: (file: File | null) => void;
  aspect?: number; disabled?: boolean; onEditingChange?: (editing: boolean) => void;
}) {
  const [source, setSource] = useState<HTMLImageElement | null>(null);
  const [position, setPosition] = useState({ x: .5, y: .5, zoom: 1 });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const preview = useRef<HTMLImageElement>(null);
  const circular = aspect === 1;

  useEffect(() => {
    if (!value) return;
    const url = URL.createObjectURL(value);
    if (preview.current) preview.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [value, source]);
  useEffect(() => () => { request.current++; }, []);
  useEffect(() => {
    if (!source || !canvas.current) return;
    const rect = cropRectangle(source.naturalWidth, source.naturalHeight, aspect, position.zoom, position.x, position.y);
    const ctx = canvas.current.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.current.width, canvas.current.height);
    ctx.drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, canvas.current.width, canvas.current.height);
  }, [source, aspect, position]);

  async function pick(file?: File) {
    if (!file) return;
    const version = ++request.current;
    setError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 20 * 1024 * 1024) {
      setError('เลือกรูป JPG, PNG หรือ WebP ขนาดไม่เกิน 20 MB'); return;
    }
    setSource(null);
    setLoading(true);
    onEditingChange?.(true);
    try {
      const image = await loadCropImage(file);
      if (version !== request.current) return;
      setPosition({ x: .5, y: .5, zoom: 1 }); setSource(image);
    } catch (err) {
      if (version === request.current) {
        setError(err instanceof Error && err.message === 'image-read-failed'
          ? 'อ่านไฟล์รูปไม่ได้ กรุณาดาวน์โหลดรูปลงเครื่องแล้วเลือกอีกครั้ง'
          : 'เปิดรูปไม่ได้ กรุณาใช้ไฟล์ JPG, PNG หรือ WebP ที่เปิดดูในเครื่องได้');
        onEditingChange?.(false);
      }
    } finally {
      if (version === request.current) {
        setLoading(false);
        if (input.current) input.current.value = '';
      }
    }
  }
  function cancel() {
    request.current++; setSource(null); setError(''); onEditingChange?.(false);
    if (input.current) input.current.value = '';
  }
  async function confirm() {
    if (!source) return;
    setSaving(true); setError('');
    try {
      const rect = cropRectangle(source.naturalWidth, source.naturalHeight, aspect, position.zoom, position.x, position.y);
      const output = document.createElement('canvas');
      output.width = circular ? 600 : 1080; output.height = Math.round(output.width / aspect);
      const ctx = output.getContext('2d');
      if (!ctx) throw new Error('canvas');
      ctx.drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, output.width, output.height);
      const blob = await new Promise<Blob | null>(resolve => output.toBlob(resolve, 'image/webp', .85));
      if (!blob) throw new Error('encode');
      onChange(new File([blob], circular ? 'profile.webp' : 'cover.webp', { type: blob.type }));
      cancel();
    } catch { setError('จัดเตรียมรูปไม่สำเร็จ กรุณาลองอีกครั้ง'); }
    finally { setSaving(false); }
  }
  return <fieldset disabled={disabled || saving} className="space-y-3 rounded-xl border border-slate-200 p-4">
    <legend className="px-1 font-semibold text-slate-900">{label}</legend>
    <p className="text-sm text-slate-500">{circular ? 'แสดงเป็นวงกลมข้างชื่อช่าง เลือกรูปใบหน้าหรือโลโก้' : 'รูปปกสัดส่วน 3:2 บนการ์ดช่าง แนะนำรูปผลงานที่อยากให้ลูกค้าเห็นเป็นภาพแรก'}</p>
    <ImageUploadButton inputRef={input} id={id} label={`${value || source ? 'เปลี่ยน' : 'เลือก'}${circular ? 'รูปโปรไฟล์' : 'รูปปก'}`} disabled={disabled || saving || loading} onChange={e => { void pick(e.target.files?.[0]); }} />
    {loading ? <p role="status" className="text-sm text-slate-500">กำลังเปิดรูปเพื่อจัดตำแหน่ง...</p> : null}
    {source ? <div className="space-y-3" role="group" aria-label={`จัดตำแหน่ง${label}`}>
      <p className="text-sm">ลากรูปเพื่อจัดตำแหน่ง หรือใช้แถบเลื่อนด้านล่าง แล้วกดใช้รูปนี้</p>
      <canvas ref={canvas} width={720} height={Math.round(720 / aspect)} aria-label={`ตัวอย่าง${label}หลังครอป`}
        className="mx-auto block w-full max-w-sm touch-none bg-slate-100" style={{ aspectRatio: aspect, borderRadius: circular ? '50%' : 12, cursor: 'grab' }}
        onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, px: position.x, py: position.y }; }}
        onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
        onPointerMove={e => {
          if (!drag.current) return;
          const rect = cropRectangle(source.naturalWidth, source.naturalHeight, aspect, position.zoom, position.x, position.y);
          const scale = e.currentTarget.getBoundingClientRect().width / rect.width;
          const dx = source.naturalWidth - rect.width, dy = source.naturalHeight - rect.height;
          const clamp = (v: number) => Math.max(0, Math.min(1, v));
          setPosition(p => ({ ...p, x: dx ? clamp(drag.current!.px - (e.clientX - drag.current!.x) / scale / dx) : .5, y: dy ? clamp(drag.current!.py - (e.clientY - drag.current!.y) / scale / dy) : .5 }));
        }} />
      {([{ key: 'zoom', label: 'ขยายรูป', min: 1, max: 3 }, { key: 'x', label: 'เลื่อนซ้าย–ขวา', min: 0, max: 1 }, { key: 'y', label: 'เลื่อนขึ้น–ลง', min: 0, max: 1 }] as const).map(item => <label key={item.key} className="flex items-center gap-3 text-sm"><span className="w-28 shrink-0">{item.label}</span><input type="range" className="min-w-0 flex-1 accent-yellow-500" min={item.min} max={item.max} step="0.01" value={position[item.key]} onChange={e => setPosition(p => ({ ...p, [item.key]: Number(e.target.value) }))} /></label>)}
      <div className="flex gap-3"><button type="button" onClick={confirm} className="rounded-lg bg-yellow-400 px-4 py-3 font-semibold">{saving ? 'กำลังเตรียมรูป...' : 'ใช้รูปนี้'}</button><button type="button" onClick={cancel} className="rounded-lg border px-4 py-3">ยกเลิก</button></div>
    </div> : value ? <div className="flex items-center gap-4"><img ref={preview} alt={`ตัวอย่าง${label}ที่เลือก`} className="w-32 object-cover" style={{ aspectRatio: aspect, borderRadius: circular ? '50%' : 8 }} /><button type="button" className="text-sm underline" onClick={() => onChange(null)}>ลบรูปที่เลือก</button><span className="text-sm text-slate-500">พร้อมบันทึก</span></div> : null}
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
  </fieldset>;
}
