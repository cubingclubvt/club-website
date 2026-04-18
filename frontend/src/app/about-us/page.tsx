"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export default function About() {
  const images = [
    "/images/cubing_club.jpg",
    "/images/first.JPG",
    "/images/second.JPG",
    // .JPG -> .jpg ??
  ];

  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 7000);

    return () => clearInterval(interval);
  }, [images.length]);

  return (
    <div>
      <div className="flex flex-col gap-5 items-center max-w-4xl w-full mx-auto my-18 px-4">
        <h2 className="text-white text-5xl text-center">About Us</h2>

        <div className="mb-8 w-full flex justify-center">
          <Image
            src={images[currentIndex]}
            alt="Virginia Tech Campus"
            width={1200}
            height={400}
            className="rounded-xl shadow-lg object-cover max-h-[400px] w-auto"
            priority
          />
        </div>

        <div className="description text-center text-gray-200 leading-relaxed space-y-5 px-2">
          <p>
            The <strong>Cubing Club at Virginia Tech</strong> is open to everyone —
            whether you’re just learning to solve a cube or you’re a nationally
            ranked speedcuber!
          </p>

          <p>
            In addition to weekly meetups, we host both official{" "}
            <strong>WCA competitions</strong> and internal practice competitions,
            with results being tracked on this site!
          </p>

          <p className="font-medium">
            Join our{" "}
            <a
              href="https://discord.gg/gMZQsqgxua"
              target="_blank"
              rel="noopener noreferrer"
              className="link link--orange"
            >
              {" "}Discord
            </a>, where all announcements and discussion occur!
          </p>
        </div>
      </div>
    </div>
  );
}