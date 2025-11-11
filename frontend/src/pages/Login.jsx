import React from "react";
import { Link } from "react-router-dom";
import background from '../assets/background.jpg'

const Login = () => {
  return (
    <div className="min-h-screen w-full flex justify-center items-center" 
         style={{ 
          position: 'fixed',
           top: 0,
           left: 0,
           width: '100vw',
           height: '100vh',
           backgroundImage: `url(${background})`,
           backgroundSize: 'cover',
           backgroundPosition: 'center',
           backgroundRepeat: 'no-repeat'
         }}>
      <div className="flex flex-col items-center justify-center">
        <div className="w-full max-w-md bg-black/30 backdrop-blur-md rounded-xl shadow-2xl border border-white/20 py-8 px-8">
          <h2 className="text-[28px] font-bold text-white mb-6 text-center">
            Login
          </h2>
          <form className="flex flex-col">
            <input
              placeholder="Email"
              className="bg-white/10 backdrop-blur-sm text-white border border-white/20 rounded-md p-3 mb-4 focus:bg-white/20 focus:border-white/40 focus:outline-none transition-all duration-150 placeholder-gray-300"
              type="email"
            />
            <input
              placeholder="Password"
              className="bg-white/10 backdrop-blur-sm text-white border border-white/20 rounded-md p-3 mb-4 focus:bg-white/20 focus:border-white/40 focus:outline-none transition-all duration-150 placeholder-gray-300"
              type="password"
            />
            <button
              className="bg-linear-to-r from-indigo-500/80 to-blue-500/80 backdrop-blur-sm text-white font-medium py-3 px-4 rounded-md hover:from-indigo-600/90 hover:to-blue-600/90 border border-white/20 transition-all duration-200 transform hover:scale-105"
              type="submit"
            >
              Submit
            </button>
            <p className="text-white mt-4 text-center">
              Don't have an account?
              <Link 
                className="text-blue-400 hover:underline mt-4 px-1" 
                to="/signup"
              >
                Sign Up
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;