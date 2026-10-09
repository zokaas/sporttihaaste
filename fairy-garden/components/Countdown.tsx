'use client';
import { useEffect, useState } from 'react';
import { EVENT_DATE } from '@/lib/garden';

export default function Countdown() {
  const [days, setDays] = useState<number | null>(null);
  useEffect(() => {
    setDays(Math.max(0, Math.ceil((Date.parse(EVENT_DATE) - Date.now()) / 86_400_000)));
  }, []);
  return (
    <p className="countdown">
      {days === null ? '✨' : days === 0 ? '🌸 Tänään on Fairy Garden! 🌸' : <>✨ <b>{days}</b> yötä Fairy Gardeniin ✨</>}
    </p>
  );
}
