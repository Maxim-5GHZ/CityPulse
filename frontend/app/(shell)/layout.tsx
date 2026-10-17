'use client';

import type { ReactNode } from 'react';
import ShaderBackgroundClient from '@/components/ShaderBackgroundClient';

export default function ShellLayout({ children }: { children: ReactNode }) {
    return (
        <div className="relative min-h-[100dvh] bg-zinc-950">
        <div
            aria-hidden="true"
            className="fixed inset-0 z-0 pointer-events-none"
            style={{
            background:
                'radial-gradient(ellipse 90% 70% at 50% 45%, rgba(140,150,175,0.18), transparent 65%),' +
                'radial-gradient(ellipse 70% 50% at 20% 80%, rgba(110,120,150,0.12), transparent 60%),' +
                'radial-gradient(ellipse 60% 50% at 80% 20%, rgba(90,100,130,0.10), transparent 60%)',
            }}
        />

        <ShaderBackgroundClient />

        <div
            aria-hidden="true"
            className="fixed inset-0 z-0 pointer-events-none bg-zinc-950/25"
        />

        <div className="relative z-10">{children}</div>
        </div>
    );
}