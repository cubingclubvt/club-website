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

// contains the file name for each icon plus the size. I have to give each an individual scale, otherwise
// every icon will sized completely inaccurately to real life (all svg's are the same size) 
const cubeParticles = [
  {src: "2x2.svg", scale: 53}, 
  {src: "3x3.svg", scale: 55},
  {src: "4x4.svg", scale: 59},
  {src: "5x5.svg", scale: 60},
  {src: "6x6.svg", scale: 63},
  {src: "7x7.svg", scale: 65},
  {src: "Clock.svg", scale: 72},
  {src: "Megaminx.svg", scale: 75},
  {src: "Pyraminx.svg", scale: 80},
  {src: "Skewb.svg", scale: 56},
  {src: "Sq1.svg", scale: 55}
]
const sizeMult = .9

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

  const options: ISourceOptions = useMemo(
    () => ({
      background: {
        color: {
          value: "transparent",
        },
      },
      fpsLimit: 120,
      particles: {
        size: {
          value: 80,
        },
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
            default: OutMode.out,
          },
          random: false,
          speed: {min: 1, max: 1.2},
          straight: false,
          // angle: {
          //   offset: 0,
          //   value: 30
          // }
          
        },
        rotate: {
          value: { min: 0, max: 360 },
          enable: true,
          animation: {
            enable: true,
            speed: {min: 2, max:2.3},
          },
        },
        number: {
          density: {
            enable: true,
            area: 3000
          },
          value: 60,
        },
        opacity: {
          value: 0.5,
        },
        shape: {
          type: "image",
          options: {
            image: cubeParticles.map((cube) => ({
              src: `/background_particles/${cube.src}`,
              width: 500,
              height: 500,
              particles: {
                size: {value:cube.scale * sizeMult}
              }
            }))
          }
        },
        collisions: {
            enable: true,
            mode: "bounce",
            overlap: {
              enable: false, 
              retries: 15
            },
        },
        // interactivity: {
        //   modes: {
        //     repulse: {
        //       distance: 300, // Distance at which they start pushing away
        //       duration: 0.1,
        //       factor: 500,
        //       speed: 100,
        //       maxSpeed: 500,
        //     }
        //   }
        // },

        shadow: {
          enable: false,
          color: {
            value: "#29384A", 
          },
          blur: 5,
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