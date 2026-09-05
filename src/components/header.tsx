import React from 'react';
import Image from 'next/image';

const Header = () => {
  return (
    <header className="bg-white shadow-md">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="logo">
          <a href="https://www.sgrru.ac.in/">
            <Image src="/images/logo.png" alt="SGRR University Logo" width={180} height={60} className="h-12 w-auto" />
          </a>
        </div>
        
        <nav className="main-menu hidden md:block">
          <ul className="flex gap-6 list-none m-0 p-0 font-medium text-gray-700">
            <li><a href="https://www.sgrru.ac.in/" className="hover:text-red-700">About SGRRU</a></li>
            <li><a href="https://www.sgrru.ac.in/#" className="hover:text-red-700">Programs</a></li>
            <li><a href="https://www.sgrru.ac.in/admission-process" className="hover:text-red-700">Admission</a></li>
            <li><a href="https://www.sgrru.ac.in/sgrru-examination-cell" className="hover:text-red-700">Academics</a></li>
            <li><a href="https://www.sgrru.ac.in/research-overview" className="hover:text-red-700">Research</a></li>
            <li><a href="https://www.sgrru.ac.in/grievance-redressal" className="hover:text-red-700">Student Life</a></li>
            <li><a href="https://www.sgrru.ac.in/contact-us" className="hover:text-red-700">Contact Us</a></li>
          </ul>
        </nav>
      </div>
    </header>
  );
};

export default Header;
