"use client";

import Link from "next/link";
import Image from "next/image";
import posthog from "posthog-js";

const Navbar = () => {
  const handleNavClick = (label: string) => {
    posthog.capture("nav_link_clicked", { label });
  };

  return (
    <header>
      <nav>
        <Link href="/" className="logo" onClick={() => handleNavClick("logo")}>
          <Image src="/icons/logo.png" alt="logo" width={24} height={24} />

          <p>DevEvent</p>
        </Link>

        <ul>
          <Link href="/" onClick={() => handleNavClick("Home")}>Home</Link>
          <Link href="/" onClick={() => handleNavClick("Events")}>Events</Link>
          <Link href="/" onClick={() => handleNavClick("Create Event")}>Create Event</Link>
        </ul>
      </nav>
    </header>
  );
};

export default Navbar;
