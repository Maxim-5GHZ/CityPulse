'use client';

import dynamic from 'next/dynamic';

// Проверка того, что библиотека реально экспортирует
if (typeof window !== 'undefined') {
    import('shaders/react').then((mod) => {
        console.log('shaders/react keys:', Object.keys(mod));
        console.log('Shader:', mod.Shader);
        console.log('Fog:', mod.Fog);
        console.log('Glow:', mod.Glow);
        console.log('DotGrid:', mod.DotGrid);
        console.log('ImageTexture:', mod.ImageTexture);
        console.log('InkFlow:', mod.InkFlow);
    });
}

const ShaderBackground = dynamic(
    () => import('@/components/ShaderBackground'),
    { ssr: false }
);

export default function ShaderBackgroundClient() {
    return <ShaderBackground />;
}