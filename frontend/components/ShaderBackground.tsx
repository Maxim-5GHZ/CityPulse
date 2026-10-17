'use client';

import { useEffect, useState } from 'react';
import {
    Shader,
    DotGrid,
    Fog,
    Glow,
    ImageTexture,
    InkFlow,
} from 'shaders/react';


export default function ShaderBackground() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setVisible(true), 250);
        return () => clearTimeout(t);
    }, []);

    return (
        <div
        className="fixed z-0 transition-opacity duration-700 ease-out pointer-events-none -inset-2"
        style={{ opacity: visible ? 1 : 0 }}
        aria-hidden="true"
        >
        <Shader>
            <Fog
            blending={1}
            mouseInfluence={0.18}
            mouseRadius={0.15}
            speed={0.3}
            turbulence={0.62}
            opacity={0.5}
            />
            <Glow intensity={0.5} threshold={0} visible={true}>
            <ImageTexture
                id="idmvb6avzpa5x15cjtg"
                boundingBox={{
                width: { unit: 'px', value: 1925 },
                height: { unit: 'px', value: 401 },
                origin: 'center',
                }}
                maskSource="idmvb6mlwvsz8g5vu8t"
                url="https://data.shaders.com/storage/v1/object/public/user-uploaded-images/user_3KKeV4TCd9d5WMy9SIBA2FP6pcR/n57uq2SnVjd5.svg"
            />
            <DotGrid
                blendMode="screen"
                density={58}
                dotSize={0.26}
                maskSource="idmvb6avzpa5x15cjtg"
                twinkle={1}
            />
            <InkFlow
                id="idmvb6mlwvsz8g5vu8t"
                color="#8f8f8f"
                colorMode="single"
                curl={1}
                decay={1.7}
                force={1.1}
                maskSource="idmvb6avzpa5x15cjtg"
                momentum={1}
                radius={0.7}
            />
            </Glow>
        </Shader>
        </div>
    );
}