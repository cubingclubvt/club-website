'use client';

// This base code is from the tsParticles react repo 

import { useEffect, useMemo, useState } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import {
  type Container,
  type ISourceOptions,
  MoveDirection,
  OutMode,
} from "@tsparticles/engine";
// import { loadAll } from "@tsparticles/all"; // if you are going to use `loadAll`, install the "@tsparticles/all" package too.
// import { loadFull } from "tsparticles"; // if you are going to use `loadFull`, install the "tsparticles" package too.
import { loadSlim } from "@tsparticles/slim"; // if you are going to use `loadSlim`, install the "@tsparticles/slim" package too.
// import { loadBasic } from "@tsparticles/basic"; // if you are going to use `loadBasic`, install the "@tsparticles/basic" package too.


export default function HomeBackground() {
  const [init, setInit] = useState(false);

  // this should be run only once per application lifetime
  useEffect(() => {
    initParticlesEngine(async (engine) => {
      // you can initiate the tsParticles instance (engine) here, adding custom shapes or presets
      // this loads the tsparticles package bundle, it's the easiest method for getting everything ready
      // starting from v2 you can add only the features you need reducing the bundle size
      //await loadAll(engine);
      //await loadFull(engine);
      await loadSlim(engine);
      //await loadBasic(engine);
    }).then(() => {
      setInit(true);
    });
  }, []);

  const particlesLoaded = async (container?: Container): Promise<void> => {
    console.log(container);
  };

  const particlePaths = ["2x2.svg", "3x3.svg", "4x4.svg", "5x5.svg", 
    "6x6.svg", "7x7.svg", "Clock.svg", "Megaminx.svg", "Pyraminx.svg", 
    "Skewb.svg", "Sq1.svg"];

  const options: ISourceOptions = useMemo(
    () => ({
      background: {
        color: {
          value: "transparent",
        },
      },
      fpsLimit: 120,
      particles: {
        color: {
          value: "#ffffff",
        },
        links: {
          color: "#ffffff",
          distance: 250,
          enable: false,
          opacity: 0.8,
          width: 3,
        },
        move: {
          direction: MoveDirection.bottom,
          enable: true,
          outModes: {
            default: "out",
          },
          random: false,
          speed: 2,
          straight: false,
          
        },
        rotate: {
          value: { min: 0, max: 360 },
          enable: true,
          animation: {
            enable: true,
            speed: {min: 2, max:4},
          },
        },
        number: {
          density: {
            enable: true,
            area: 1200
          },
          value: 75,
        },
        opacity: {
          value: 0.5,
        },
        shape: {
          type: "image",
          options: {
            image: particlePaths.map((path) => ({
              src: `/background_particles/${path}`,
              width: 500,
              height: 500
            }))
          }
        },
        size: {
          value: {min: 40, max: 50},
        },
        collisions: {
            enable: true,
            mode: "bounce",
            overlap: {
              enable: false, 
            }
        },
        shadow: {
          enable: true,
          color: {
            value: "#113243", 
          },
          blur: 10,
          offset: {
            x: 0,
            y: 0
          }
        },
      },
      
      detectRetina: true,
    }),
    [],
  );

  if (init) {
    return (
      <Particles
        id="tsparticles"
        particlesLoaded={particlesLoaded}
        options={options}
        className="absolute inset-0"
      />
    );
  }

  return <></>;
};