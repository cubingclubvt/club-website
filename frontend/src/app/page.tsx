
import dynamic from 'next/dynamic';

const ModelViewer = dynamic(() =>
    import('@/components/CubeScene'), { ssr: true });

export default function CubePage() {
    return (
        <div className={""}>
            <div className="flex flex-col justify-between items-center pt-[15vh]">
                <div className={"text-center"}>
                    {/*TODO: i want to add a fun scramble/mix animation for the title words when first loaded*/}
                    <h1 className="text-6xl text-white mb-15">Cubing Club at VT</h1>
                </div>
                <ModelViewer />
            </div>
        </div>
    );
}
