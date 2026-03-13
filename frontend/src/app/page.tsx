"use client";
import dynamic from 'next/dynamic';
import TextScramble from '@/components/TextScramble';

const ModelViewer = dynamic(() =>
    import('@/components/CubeScene'), { 
        ssr: false, 
        loading: () => <div className="h-[50vh] flex items-center justify-center">
        <div className="w-11 h-11 border-5 border-white/30 border-t-white rounded-full animate-spin" />
      </div>});

const ParticleBackground = dynamic(() =>
    import('@/components/HomeBackground'), {ssr: false});

export default function CubePage() {
    return (
        <div className="relative min-h-screen overflow-hidden">
            <ParticleBackground />

            <div className="relative z-10 flex flex-col items-center pt-[15vh]">
                <div className={"text-center"}>
                    <h1 className="text-6xl text-white mb-15">
                        <TextScramble text="Cubing Club at VT"/>
                    </h1>
                </div>
                <ModelViewer />
            </div>
        </div>
    );
}

